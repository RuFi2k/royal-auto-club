// Thin HTTP client for the AUTO.RIA (developers.ria.com) advertisement API.
//
// Auth is via query params (user_id + api_key) on every request. The feature is
// silently disabled when either env var is missing — mirrors the Telegram poster.
//
// Docs: https://api-docs-v2.readthedocs.io/ru/latest/auto_ria/used_cars/personalized/

const DEFAULT_BASE = "https://developers.ria.com";

export interface AutoRiaConfig {
  base: string;
  userId: string;
  apiKey: string;
  // The photo-upload endpoint is the only one that authenticates the ad owner
  // via the RIA.com login cookie (PSP_ID, 30-day lifetime) instead of user_id.
  // Without it photo upload fails; the rest of the API works without it.
  pspId?: string;
}

export function autoriaConfig(): AutoRiaConfig | null {
  const userId = process.env.AUTORIA_USER_ID;
  const apiKey = process.env.AUTORIA_API_KEY;
  if (!userId || !apiKey) return null;
  const base = (process.env.AUTORIA_API_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
  const pspId = process.env.AUTORIA_PSP_ID || undefined;
  return { base, userId, apiKey, pspId };
}

export class AutoRiaError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "AutoRiaError";
    this.status = status;
    this.body = body;
  }
}

function withAuth(cfg: AutoRiaConfig, path: string, includeUserId: boolean): string {
  const url = new URL(`${cfg.base}${path}`);
  url.searchParams.set("api_key", cfg.apiKey);
  if (includeUserId) url.searchParams.set("user_id", cfg.userId);
  return url.toString();
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handle(res: Response): Promise<unknown> {
  const body = await parse(res);
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body && String((body as { error: unknown }).error)) ||
      (typeof body === "string" && body) ||
      res.statusText;
    throw new AutoRiaError(res.status, `AUTO.RIA ${res.status}: ${msg}`, body);
  }
  return body;
}

// Reference/lookup GET (no user_id needed): categories, marks, models, colors…
export async function riaGet<T>(cfg: AutoRiaConfig, path: string): Promise<T> {
  const res = await fetch(withAuth(cfg, path, false));
  return (await handle(res)) as T;
}

// Advertisement management calls (require user_id).
export async function riaPost<T>(cfg: AutoRiaConfig, path: string, body: unknown): Promise<T> {
  const res = await fetch(withAuth(cfg, path, true), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await handle(res)) as T;
}

export async function riaPut<T>(cfg: AutoRiaConfig, path: string, body: unknown): Promise<T> {
  const res = await fetch(withAuth(cfg, path, true), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await handle(res)) as T;
}

// Ad deletion requires a reason_id: 4=sold via AUTO.RIA, 5=sold elsewhere,
// 6=reposting, 7=no longer selling. Omitting it returns 400.
export const RIA_DELETE_REASON = {
  SOLD_ELSEWHERE: 5,
  REPOSTING: 6,
  NO_LONGER_SELLING: 7,
} as const;

export async function riaDelete<T>(
  cfg: AutoRiaConfig,
  path: string,
  reasonId: number = RIA_DELETE_REASON.NO_LONGER_SELLING,
): Promise<T> {
  const url = new URL(withAuth(cfg, path, true));
  url.searchParams.set("reason_id", String(reasonId));
  const res = await fetch(url.toString(), { method: "DELETE" });
  return (await handle(res)) as T;
}

// Ad equipment. The create/update payload's `options` array is ignored by the
// API, so equipment is managed through these dedicated endpoints.
//
// AUTO.RIA stores it TWICE — a legacy table keyed by classic id, and an
// optionsV2 table keyed by v2 id — and the cabinet UI renders only the v2 one.
// Writing via the classic endpoints fills the legacy table ONLY, which is why
// ads published that way show an empty equipment section. Verified live
// (2026-07-14) against ad 40153791:
//   - POST /options (classic ids)   → legacy only; GET /optionsV2 stays []
//   - PUT  /optionsV2 (v2 entries)  → writes BOTH tables
//   - DELETE /optionsV2             → clears ALL options, not the ids passed
// So the v2 PUT is the only correct write, and being a full-set replace it also
// removes stale options — no read-then-reconcile needed.
export interface AdOptionV2 {
  optionId: number;
  // 1 for a checkbox; the v2 value id for a selectable (e.g. seatHeated).
  optionValue: number;
}

export async function riaGetAdOptionsV2(cfg: AutoRiaConfig, adId: string): Promise<AdOptionV2[]> {
  const res = await fetch(withAuth(cfg, `/auto/used/autos/${adId}/optionsV2`, true));
  const body = await handle(res);
  if (!Array.isArray(body)) return [];
  return body as AdOptionV2[];
}

// Full-set replace: the ad ends up with exactly `entries`. Also rewrites the
// legacy table (mapped ids only), so run it BEFORE riaAddAdOptions.
export async function riaPutAdOptionsV2(
  cfg: AutoRiaConfig,
  adId: string,
  entries: AdOptionV2[],
): Promise<void> {
  const res = await fetch(withAuth(cfg, `/auto/used/autos/${adId}/optionsV2`, true), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });
  await handle(res);
}

// Legacy write, by classic id. The UI's equipment section won't render these,
// but AUTO.RIA's SEARCH indexes the legacy table (`auto_options[636]=636`), so
// this is the only way to publish the options optionsV2 has no id for — they
// stay filterable even though they aren't displayed. POST is not idempotent:
// only send ids the ad doesn't already have.
export async function riaAddAdOptions(
  cfg: AutoRiaConfig,
  adId: string,
  ids: number[],
): Promise<void> {
  if (ids.length === 0) return;
  const res = await fetch(withAuth(cfg, `/auto/used/autos/${adId}/options`, true), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids.map((id) => ({ id }))),
  });
  await handle(res);
}

// Photo upload: POST /auto/used/autos/:adId/photos/upload with a JSON body of
// PUBLIC image URLs — AUTO.RIA fetches them itself, one request for all photos:
//   { "main": "<url>", "links": ["<url>", ...] }
// Requires the PSP_ID cookie for owner auth (see AutoRiaConfig.pspId).
export async function riaUploadPhotos(
  cfg: AutoRiaConfig,
  adId: string,
  mainUrl: string,
  linkUrls: string[],
): Promise<unknown> {
  if (!cfg.pspId) {
    throw new AutoRiaError(0, "AUTO.RIA: AUTORIA_PSP_ID не задано — фото не завантажуються");
  }
  const res = await fetch(withAuth(cfg, `/auto/used/autos/${adId}/photos/upload`, true), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `PSP_ID=${cfg.pspId}`,
    },
    body: JSON.stringify({ main: mainUrl, links: linkUrls }),
  });
  return handle(res);
}
