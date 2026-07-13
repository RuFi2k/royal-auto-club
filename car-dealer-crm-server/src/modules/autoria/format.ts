// Builds the AUTO.RIA advertisement payload from a Car + resolved reference ids.
//
// Create body shape (POST /auto/used/autos), per the personalized API docs:
//   { year, price:{value,currency:{id}}, categories:{main:{id}}, brand:{id},
//     model:{id}, body:{id}, mileage, region:{id}, city:{id}, VIN,
//     gearbox:{id}, drive:{id}, fuel:{id,...}, engine:{volume:{liters}},
//     power:{hp}, color:{id,metallic}, doors, seats, description:{ru,uk}, ... }
import type { Car, CarOption } from "@prisma/client";
import type { ResolvedCarIds } from "./mapping";
import { SELECTABLE_BY_ID } from "./options-catalog";

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// AUTO.RIA descriptions have a minimum length; pad from spec if the admin copy
// is too short so the ad isn't rejected.
const MIN_DESCRIPTION = 30;

function buildDescription(car: Car): string {
  const primary = stripHtml(car.description) || stripHtml(car.shortDescription);
  if (primary && primary.length >= MIN_DESCRIPTION) return primary;

  const specLine = [
    `${car.year} ${car.brand} ${car.model}`,
    `${Number(car.engineVolume).toFixed(1)}L`,
    `${car.enginePower} к.с.`,
    `пробіг ${car.mileage} тис. км`,
  ].join(", ");
  return [primary, specLine].filter(Boolean).join("\n\n");
}

// Both the Car model and AUTO.RIA store mileage in thousands of km
// (AUTO.RIA: "Одиниці вимірювання: тис.км", e.g. mileage:32 == 32 000 km),
// so pass the value through unchanged.
function mileageThousandsKm(car: Car): number {
  return Math.max(0, Math.round(car.mileage));
}

export interface AutoRiaAdPayload {
  year: number;
  categories: { main: { id: number } };
  brand: { id: number };
  model: { id: number };
  mileage: number;
  VIN: string;
  price: { value: number; currency: { id: number } };
  engine: { volume: { liters: number } };
  power: { hp: number };
  doors: number;
  seats: number;
  description: { ru: string; uk: string };
  body?: { id: number };
  gearbox?: { id: number };
  drive?: { id: number };
  fuel?: { id: number };
  color?: { id: number; metallic: boolean };
  region?: { id: number };
  city?: { id: number };
  damage?: boolean;
  // Selectable options are added dynamically by field name (e.g. seatHeated).
  // NOTE: binary (checkbox) options are NOT part of this payload — the API
  // ignores an `options` array here; they're managed via the dedicated
  // options endpoints (see poster.syncAdBinaryOptions).
  [field: string]: unknown;
}

// Applies the car's SELECTABLE options as dedicated payload fields keyed by their
// catalog `field` name, e.g. `seatHeated:{id: valueId}`. Binary options are
// handled separately (the payload's options array is ignored by AUTO.RIA).
function applySelectableOptions(payload: AutoRiaAdPayload, options: CarOption[]): void {
  for (const o of options) {
    const selectable = SELECTABLE_BY_ID.get(o.optionId);
    if (selectable && o.valueId !== null) {
      payload[selectable.field] = { id: o.valueId };
    }
  }
}

// `vin` is passed in decrypted (the Car row stores it encrypted).
export function buildAdPayload(
  car: Car,
  ids: ResolvedCarIds,
  vin: string,
  options: CarOption[] = [],
): AutoRiaAdPayload {
  const description = buildDescription(car);
  const payload: AutoRiaAdPayload = {
    year: car.year,
    categories: { main: { id: ids.categoryId } },
    brand: { id: ids.markId },
    model: { id: ids.modelId },
    mileage: mileageThousandsKm(car),
    VIN: vin,
    price: { value: Math.round(Number(car.dealerPrice)), currency: { id: ids.currencyId } },
    engine: { volume: { liters: Number(car.engineVolume) } },
    power: { hp: car.enginePower },
    doors: car.doorsCount,
    seats: car.seatsCount,
    description: { ru: description, uk: description },
    damage: car.crashed && !car.accidentFree,
  };

  if (ids.bodyId !== null) payload.body = { id: ids.bodyId };
  if (ids.gearboxId !== null) payload.gearbox = { id: ids.gearboxId };
  if (ids.driveId !== null) payload.drive = { id: ids.driveId };
  if (ids.fuelId !== null) payload.fuel = { id: ids.fuelId };
  if (ids.colorId !== null) payload.color = { id: ids.colorId, metallic: false };
  if (ids.regionId !== null) payload.region = { id: ids.regionId };
  if (ids.cityId !== null) payload.city = { id: ids.cityId };

  applySelectableOptions(payload, options);

  return payload;
}

// Subset that's cheap/safe to change after posting (price is editable any time;
// basic params only within ~1h of posting). We send the full payload on update
// and let AUTO.RIA apply what it allows.
export function buildUpdatePayload(
  car: Car,
  ids: ResolvedCarIds,
  vin: string,
  options: CarOption[] = [],
): AutoRiaAdPayload {
  return buildAdPayload(car, ids, vin, options);
}
