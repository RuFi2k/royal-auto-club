// AUTO.RIA advertisement lifecycle — mirrors modules/telegram/poster.ts.
//
// Publishing is MANUAL (admin clicks "Publish"), because AUTO.RIA bills per
// listing. Once an ad exists (car.autoriaAdId set), edits sync automatically and
// selling/archiving/deleting the car removes the ad.
import type { Car } from "@prisma/client";
import { prisma } from "../../db";
import { decrypt } from "../../lib/encryption";
import {
  autoriaConfig,
  AutoRiaConfig,
  AdOptionV2,
  riaPost,
  riaPut,
  riaDelete,
  riaUploadPhotos,
  riaPutAdOptionsV2,
  riaAddAdOptions,
  RIA_DELETE_REASON,
} from "./client";
import { resolveCarIds } from "./mapping";
import { buildAdPayload, buildUpdatePayload } from "./format";
import {
  BINARY_IDS,
  BINARY_V2_BY_ID,
  SELECTABLE_BY_ID,
  SELECTABLE_ID_BASE,
} from "./options-catalog";

// Car.vinNumber is stored encrypted; tolerate legacy plaintext rows.
function carVin(car: Car): string {
  try {
    return decrypt(car.vinNumber);
  } catch {
    return car.vinNumber;
  }
}

// Best-effort extraction of the ad id from a create response.
function extractAdId(res: unknown): string | null {
  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    const candidate = o._id ?? o.id ?? o.autoId ?? o.advertisementId;
    if (candidate !== undefined && candidate !== null) return String(candidate);
  }
  if (typeof res === "number" || typeof res === "string") return String(res);
  return null;
}

async function carWithPhotos(carId: number) {
  return prisma.car.findUnique({
    where: { id: carId },
    include: {
      photos: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      options: true,
    },
  });
}

function photoUrls(car: { photoUrl: string | null; photos: { url: string }[] }): string[] {
  const urls = car.photos.map((p) => p.url);
  if (urls.length === 0 && car.photoUrl) urls.push(car.photoUrl);
  return urls.slice(0, 30); // AUTO.RIA allows many photos; cap defensively.
}

// AUTO.RIA fetches the images itself from the URLs we send, so they must be
// publicly reachable (our CRM media host is). One request uploads all photos.
async function uploadPhotos(cfg: AutoRiaConfig, adId: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  if (!cfg.pspId) {
    console.error(`[autoria] AUTORIA_PSP_ID not set — skipping photo upload for ad ${adId}`);
    return;
  }
  try {
    await riaUploadPhotos(cfg, adId, urls[0], urls.slice(1));
  } catch (err) {
    console.error(`[autoria] photo upload failed for ad ${adId}:`, err);
  }
}

// Equipment lives behind a dedicated endpoint (the ad payload's `options` array
// is ignored). The v2 PUT is a full-set replace covering both of AUTO.RIA's
// stores, so we just build the desired set and send it — no reconcile.
//
// Selectable options are sent here AND ride along as ad-payload fields; the
// cabinet UI reads them from the v2 store, so both are needed.
function splitAdOptions(options: { optionId: number; valueId: number | null }[]): {
  v2: AdOptionV2[];
  legacyOnly: number[];
} {
  const v2: AdOptionV2[] = [];
  const legacyOnly: number[] = [];
  for (const o of options) {
    if (o.valueId === null) {
      const mapped = BINARY_V2_BY_ID.get(o.optionId);
      if (mapped !== undefined) v2.push({ optionId: mapped, optionValue: 1 });
      // No v2 id → publishable only to the legacy table. AUTO.RIA won't render
      // it, but its search still indexes it, so it keeps the ad filterable.
      else if (BINARY_IDS.has(o.optionId)) legacyOnly.push(o.optionId);
      continue;
    }
    const sel = SELECTABLE_BY_ID.get(o.optionId);
    const value = sel?.values.find((v) => v.id === o.valueId);
    if (sel && value) {
      v2.push({ optionId: sel.id - SELECTABLE_ID_BASE, optionValue: value.v2 });
    }
  }
  return { v2, legacyOnly };
}

async function syncAdOptions(
  cfg: AutoRiaConfig,
  adId: string,
  options: { optionId: number; valueId: number | null }[],
): Promise<void> {
  const { v2, legacyOnly } = splitAdOptions(options);
  try {
    // Order matters: the v2 PUT rewrites the legacy table too, so it would wipe
    // these ids if it ran second.
    await riaPutAdOptionsV2(cfg, adId, v2);
    await riaAddAdOptions(cfg, adId, legacyOnly);
  } catch (err) {
    console.error(`[autoria] sync options failed for ad ${adId}:`, err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

// Explicit publish (or republish). Creates the ad, stores its id, uploads photos.
// If already published, the existing ad is deleted first so photos refresh.
export async function publishCarToAutoRia(carId: number): Promise<{ adId: string | null }> {
  const cfg = autoriaConfig();
  if (!cfg) throw new Error("AUTO.RIA не налаштовано");

  const car = await carWithPhotos(carId);
  if (!car) throw new Error("Автомобіль не знайдено");
  if (car.listingStatus === "archived") throw new Error("Архівні авто не публікуються на AUTO.RIA");
  if (car.listingStatus === "sold") throw new Error("Продані авто не публікуються на AUTO.RIA");

  // Refresh: drop the previous ad so we can recreate cleanly (photos included).
  if (car.autoriaAdId) {
    await deleteAdById(cfg, car.autoriaAdId, RIA_DELETE_REASON.REPOSTING);
    await prisma.car.update({ where: { id: car.id }, data: { autoriaAdId: null } });
  }

  const ids = await resolveCarIds(cfg, car);
  const payload = buildAdPayload(car, ids, carVin(car), car.options);
  const res = await riaPost<unknown>(cfg, "/auto/used/autos/", payload);
  const adId = extractAdId(res);
  if (!adId) throw new Error("AUTO.RIA не повернув id оголошення");

  await prisma.car.update({ where: { id: car.id }, data: { autoriaAdId: adId } });
  await syncAdOptions(cfg, adId, car.options);
  await uploadPhotos(cfg, adId, photoUrls(car));
  return { adId };
}

// Fire-and-forget sync on car change. No-op unless the car already has an ad.
// available/upcoming → PUT update; sold/archived → delete the ad.
export function syncCarAutoRiaAd(carId: number): void {
  void runSync(carId).catch((err) => {
    console.error(`[autoria] sync failed for car ${carId}:`, err);
  });
}

async function runSync(carId: number): Promise<void> {
  const cfg = autoriaConfig();
  if (!cfg) return; // disabled silently when env not set

  const car = await prisma.car.findUnique({ where: { id: carId }, include: { options: true } });
  if (!car || !car.autoriaAdId) return; // never published → nothing to sync

  if (car.listingStatus === "sold" || car.listingStatus === "archived") {
    const reason =
      car.listingStatus === "sold"
        ? RIA_DELETE_REASON.SOLD_ELSEWHERE
        : RIA_DELETE_REASON.NO_LONGER_SELLING;
    await deleteAdById(cfg, car.autoriaAdId, reason);
    await prisma.car.update({ where: { id: car.id }, data: { autoriaAdId: null } });
    return;
  }

  const ids = await resolveCarIds(cfg, car);
  const payload = buildUpdatePayload(car, ids, carVin(car), car.options);
  await riaPut(cfg, `/auto/used/autos/${car.autoriaAdId}`, payload);
  await syncAdOptions(cfg, car.autoriaAdId, car.options);
}

// Explicit delete (button). Removes the ad and clears the stored id.
export async function deleteCarAutoRiaAd(carId: number): Promise<void> {
  const cfg = autoriaConfig();
  if (!cfg) throw new Error("AUTO.RIA не налаштовано");

  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw new Error("Автомобіль не знайдено");
  if (!car.autoriaAdId) return;

  await deleteAdById(cfg, car.autoriaAdId, RIA_DELETE_REASON.NO_LONGER_SELLING);
  await prisma.car.update({ where: { id: car.id }, data: { autoriaAdId: null } });
}

// Low-level delete by ad id — used when the whole car row is being removed
// (the row is gone, so there's nothing to null out afterwards).
export async function deleteAutoRiaAdById(adId: string | null | undefined): Promise<void> {
  const cfg = autoriaConfig();
  if (!cfg || !adId) return;
  await deleteAdById(cfg, adId, RIA_DELETE_REASON.NO_LONGER_SELLING);
}

async function deleteAdById(cfg: AutoRiaConfig, adId: string, reasonId: number): Promise<void> {
  try {
    await riaDelete(cfg, `/auto/used/autos/${adId}`, reasonId);
  } catch (err) {
    // "not found" / already-deleted → treat as gone.
    console.error(`[autoria] delete ad ${adId} failed:`, err);
  }
}
