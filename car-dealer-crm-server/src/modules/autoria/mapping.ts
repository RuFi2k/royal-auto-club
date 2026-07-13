// Maps our Car fields to AUTO.RIA numeric IDs.
//
// AUTO.RIA references everything by numeric `value` ids returned from lookup
// endpoints (each item is `{ name, value }`). Rather than hard-coding ids that
// can drift, we fetch the reference lists live and match by name — our enums map
// to the Ukrainian/Russian label AUTO.RIA uses, and we resolve that label to its
// id. Lists are cached in-memory for the process lifetime (they rarely change).
//
// Reference endpoints (see AUTO.RIA REST API docs):
//   GET /auto/categories
//   GET /auto/categories/:cat/bodystyles
//   GET /auto/categories/:cat/marks
//   GET /auto/categories/:cat/marks/:mark/models
//   GET /auto/categories/:cat/gearboxes
//   GET /auto/categories/:cat/driverTypes
//   GET /auto/type            (fuel)
//   GET /auto/colors
//   GET /auto/states          (regions)
//   GET /auto/states/:state/cities
import type { Car } from "@prisma/client";
import { AutoRiaConfig, riaGet } from "./client";

// AUTO.RIA "Легкові" (passenger cars) category. Cars only ever use this.
export const CAR_CATEGORY_ID = 1;

// Currency ids on AUTO.RIA: 1=USD, 2=EUR, 3=UAH. Our prices are USD.
export const USD_CURRENCY_ID = 1;

interface RiaRef {
  name: string;
  value: number;
}

// ── Enum → AUTO.RIA label maps ────────────────────────────────────────────────
// Values are the labels AUTO.RIA returns from its reference lists; we match them
// case-insensitively, tolerating minor spacing/synonym differences.

const BODY_TYPE_LABELS: Record<string, string[]> = {
  sedan: ["Седан"],
  suv: ["Позашляховик / Кросовер", "Внедорожник / Кроссовер"],
  crossover: ["Позашляховик / Кросовер", "Внедорожник / Кроссовер"],
  hatchback: ["Хетчбек", "Хэтчбек"],
  coupe: ["Купе"],
  // Note: category-1 list spells it with a Latin "i" ("Унiверсал"); include both.
  wagon: ["Універсал", "Унiверсал", "Универсал"],
  minivan: ["Мінівен", "Минивэн"],
  pickup: ["Пікап", "Пикап"],
  van: ["Вантажопасажирський фургон", "Фургон"],
  convertible: ["Кабріолет", "Кабриолет"],
  liftback: ["Ліфтбек", "Лифтбек", "Хетчбек", "Хэтчбек"],
};

const GEARBOX_LABELS: Record<string, string[]> = {
  manual: ["Ручна / Механіка", "Ручная / Механика"],
  automatic: ["Автомат"],
  cvt: ["Варіатор", "Вариатор"],
  robot: ["Робот"],
  dual_clutch: ["Робот", "Типтронік", "Типтроник"],
};

const DRIVETRAIN_LABELS: Record<string, string[]> = {
  fwd: ["Передній", "Передний"],
  rwd: ["Задній", "Задний", "Кардан"],
  awd: ["Повний", "Полный"],
  four_wd: ["Повний", "Полный"],
};

const FUEL_LABELS: Record<string, string[]> = {
  gasoline: ["Бензин"],
  diesel: ["Дизель"],
  electric: ["Електро", "Электро"],
  hybrid_gasoline: ["Гібрид", "Гибрид"],
  hybrid_diesel: ["Гібрид", "Гибрид"],
  gas: ["Газ"],
  // AUTO.RIA has no plain "Газ / Бензин"; the real dual-fuel labels are
  // propane and methane variants. Prefer propane-butane (the common LPG retrofit).
  gasoline_gas: [
    "Газ пропан-бутан / Бензин",
    "Газ метан / Бензин",
    "Газ / Бензин",
    "Бензин / Газ",
  ],
};

// Our free-text color strings → AUTO.RIA color labels (best-effort).
const COLOR_LABELS: Record<string, string[]> = {
  чорний: ["Чорний", "Черный"],
  білий: ["Білий", "Белый"],
  сірий: ["Сірий", "Серый"],
  // AUTO.RIA has no silver/gold colors — fall back to the nearest available
  // (grey for silver, beige for gold). Try the exact label first anyway.
  сріблястий: ["Сріблястий", "Серебристый", "Сірий", "Серый"],
  синій: ["Синій", "Синий"],
  червоний: ["Червоний", "Красный"],
  зелений: ["Зелений", "Зеленый"],
  бежевий: ["Бежевий", "Бежевый"],
  коричневий: ["Коричневий", "Коричневый"],
  жовтий: ["Жовтий", "Желтый"],
  помаранчевий: ["Помаранчевий", "Оранжевый"],
  золотистий: ["Золотистий", "Золотистый", "Бежевий", "Бежевый"],
  фіолетовий: ["Фіолетовий", "Фиолетовый"],
};

// ── Cached reference lookups ──────────────────────────────────────────────────

const cache = new Map<string, RiaRef[]>();

async function getRef(cfg: AutoRiaConfig, path: string): Promise<RiaRef[]> {
  const cached = cache.get(path);
  if (cached) return cached;
  const raw = await riaGet<unknown>(cfg, path);
  const list = normalizeRefList(raw);
  cache.set(path, list);
  return list;
}

// AUTO.RIA returns either an array of {name,value} or an object keyed by id.
function normalizeRefList(raw: unknown): RiaRef[] {
  if (Array.isArray(raw)) {
    return raw
      .map((r) => ({ name: String((r as RiaRef).name ?? ""), value: Number((r as RiaRef).value) }))
      .filter((r) => r.name && Number.isFinite(r.value));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([k, v]) => ({
      name: String(v),
      value: Number(k),
    }));
  }
  return [];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s./-]+/g, " ").trim();
}

// Match a list item against a set of candidate labels (exact-normalized, then
// substring). Returns the matched value id or null.
function matchLabel(list: RiaRef[], candidates: string[]): number | null {
  const wanted = candidates.map(norm);
  for (const item of list) {
    if (wanted.includes(norm(item.name))) return item.value;
  }
  for (const item of list) {
    const n = norm(item.name);
    if (wanted.some((w) => n.includes(w) || w.includes(n))) return item.value;
  }
  return null;
}

function matchByName(list: RiaRef[], name: string): number | null {
  const target = norm(name);
  for (const item of list) {
    if (norm(item.name) === target) return item.value;
  }
  for (const item of list) {
    if (norm(item.name).includes(target) || target.includes(norm(item.name))) return item.value;
  }
  return null;
}

// ── Public resolvers ──────────────────────────────────────────────────────────

const CAT = CAR_CATEGORY_ID;

export async function resolveMark(cfg: AutoRiaConfig, brand: string): Promise<number | null> {
  const list = await getRef(cfg, `/auto/categories/${CAT}/marks`);
  return matchByName(list, brand);
}

export async function resolveModel(cfg: AutoRiaConfig, markId: number, model: string): Promise<number | null> {
  const list = await getRef(cfg, `/auto/categories/${CAT}/marks/${markId}/models`);
  return matchByName(list, model);
}

export async function resolveBody(cfg: AutoRiaConfig, bodyType: string): Promise<number | null> {
  const list = await getRef(cfg, `/auto/categories/${CAT}/bodystyles`);
  return matchLabel(list, BODY_TYPE_LABELS[bodyType] ?? [bodyType]);
}

export async function resolveGearbox(cfg: AutoRiaConfig, gearbox: string): Promise<number | null> {
  const list = await getRef(cfg, `/auto/categories/${CAT}/gearboxes`);
  return matchLabel(list, GEARBOX_LABELS[gearbox] ?? [gearbox]);
}

export async function resolveDrive(cfg: AutoRiaConfig, drivetrain: string): Promise<number | null> {
  const list = await getRef(cfg, `/auto/categories/${CAT}/driverTypes`);
  return matchLabel(list, DRIVETRAIN_LABELS[drivetrain] ?? [drivetrain]);
}

export async function resolveFuel(cfg: AutoRiaConfig, engineType: string): Promise<number | null> {
  const list = await getRef(cfg, `/auto/type`);
  return matchLabel(list, FUEL_LABELS[engineType] ?? [engineType]);
}

export async function resolveColor(cfg: AutoRiaConfig, color: string): Promise<number | null> {
  const list = await getRef(cfg, `/auto/colors`);
  const key = norm(color);
  const labels = COLOR_LABELS[key] ?? [color];
  return matchLabel(list, labels);
}

// Region + city from our free-text `location`. We try each state's cities and
// match the location string against a city name; the ad requires both ids.
export async function resolveRegionCity(
  cfg: AutoRiaConfig,
  location: string,
): Promise<{ regionId: number; cityId: number } | null> {
  // Allow an explicit default (e.g. the dealership home city) to avoid scanning.
  const defRegion = process.env.AUTORIA_DEFAULT_REGION_ID;
  const defCity = process.env.AUTORIA_DEFAULT_CITY_ID;
  if (defRegion && defCity) {
    return { regionId: Number(defRegion), cityId: Number(defCity) };
  }

  const states = await getRef(cfg, `/auto/states`);
  const loc = norm(location);
  for (const state of states) {
    const cities = await getRef(cfg, `/auto/states/${state.value}/cities`);
    for (const city of cities) {
      if (loc.includes(norm(city.name))) {
        return { regionId: state.value, cityId: city.value };
      }
    }
  }
  return null;
}

export interface ResolvedCarIds {
  categoryId: number;
  markId: number;
  modelId: number;
  bodyId: number | null;
  gearboxId: number | null;
  driveId: number | null;
  fuelId: number | null;
  colorId: number | null;
  regionId: number | null;
  cityId: number | null;
  currencyId: number;
}

// Resolve every id a create/update needs. Throws with a clear message when a
// required id (mark/model) can't be matched, so the caller can surface it.
export async function resolveCarIds(cfg: AutoRiaConfig, car: Car): Promise<ResolvedCarIds> {
  const markId = await resolveMark(cfg, car.brand);
  if (markId === null) {
    throw new Error(`AUTO.RIA: не знайдено марку "${car.brand}"`);
  }
  const modelId = await resolveModel(cfg, markId, car.model);
  if (modelId === null) {
    throw new Error(`AUTO.RIA: не знайдено модель "${car.model}" для марки "${car.brand}"`);
  }

  const [bodyId, gearboxId, driveId, fuelId, colorId, regionCity] = await Promise.all([
    resolveBody(cfg, car.bodyType),
    resolveGearbox(cfg, car.gearboxType),
    resolveDrive(cfg, car.drivetrain),
    resolveFuel(cfg, car.engineType),
    resolveColor(cfg, car.color),
    resolveRegionCity(cfg, car.location),
  ]);

  // AUTO.RIA marks body, region and city as required on the add-ad form; a POST
  // without them is rejected, so fail early with a clear message.
  if (bodyId === null) {
    throw new Error(`AUTO.RIA: не знайдено тип кузова "${car.bodyType}"`);
  }
  if (!regionCity) {
    throw new Error(
      `AUTO.RIA: не вдалося визначити область/місто для "${car.location}" — ` +
        `задайте AUTORIA_DEFAULT_REGION_ID/AUTORIA_DEFAULT_CITY_ID`,
    );
  }

  return {
    categoryId: CAT,
    markId,
    modelId,
    bodyId,
    gearboxId,
    driveId,
    fuelId,
    colorId,
    regionId: regionCity?.regionId ?? null,
    cityId: regionCity?.cityId ?? null,
    currencyId: USD_CURRENCY_ID,
  };
}
