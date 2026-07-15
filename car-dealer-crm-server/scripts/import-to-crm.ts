// Import scraped Auto.RIA cars (under ../../seed) into the live CRM.
//
// Usage:
//   export CRM_TOKEN='<firebase id token>'
//   cd crm/car-dealer-crm-server && npx tsx scripts/import-to-crm.ts [--limit=N] [--dry] [--wipe] [--no-crop]
//
// Photos are cropped (top WATERMARK_CROP_PCT removed) before upload to strip
// the auto.ria watermark. Pass --no-crop to upload originals.
// Pass --wipe to DELETE every existing CRM car before importing.
// Idempotent: if a car with the same VIN already exists, server returns 409
// (caught and skipped).

import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const API = "https://api.royalautoclub.org";
const BUCKET = "cars-dealer-crm.firebasestorage.app";
const SEED = resolve(__dirname, "../../seed");
const TOKEN = process.env.CRM_TOKEN;
const RESPONSIBLE = "maxplayer3@gmail.com";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const WIPE = args.has("--wipe");
const CROP = !args.has("--no-crop");
const WATERMARK_CROP_PCT = 0.08; // top 8% covers the auto.ria badge
const LIMIT = (() => {
  for (const a of args) {
    const m = a.match(/^--limit=(\d+)$/);
    if (m) return Number(m[1]);
  }
  return Infinity;
})();

if (!TOKEN && !args.has("--dry")) {
  console.error("CRM_TOKEN env var required (skip with --dry)");
  process.exit(1);
}

type Scraped = {
  id: number;
  url: string;
  title?: string;
  brand?: string;
  model?: string;
  year?: number;
  mileageKm?: number;
  priceUsd?: number;
  color?: string;
  bodyType?: string;
  engine?: string;
  enginePowerHp?: number;
  engineVolumeL?: number;
  fuelType?: string;
  gearbox?: string;
  drivetrain?: string;
  doors?: number;
  seats?: number;
  vin?: string;
  location?: string;
  description?: string;
  photos: string[];
};

const ENGINE: Record<string, string> = {
  "Бензин": "gasoline",
  "Дизель": "diesel",
  "Електро": "electric",
  "Гібрид": "hybrid_gasoline",
  "Гібрид (HEV)": "hybrid_gasoline",
  "Гібрид (PHEV)": "hybrid_gasoline",
  "Газ": "gas",
  "Газ/Бензин": "gasoline_gas",
  "Бензин/Газ": "gasoline_gas",
};
const BODY: Record<string, string> = {
  "Седан": "sedan",
  "Позашляховик / Кросовер": "suv",
  "Позашляховик": "suv",
  "Кросовер": "crossover",
  "Хетчбек": "hatchback",
  "Купе": "coupe",
  "Універсал": "wagon",
  "Мінівен": "minivan",
  "Пікап": "pickup",
  "Фургон": "van",
  "Кабріолет": "convertible",
  "Ліфтбек": "liftback",
};
const GEARBOX: Record<string, string> = {
  "Автомат": "automatic",
  "Типтронік": "automatic",
  "Редуктор": "automatic", // EV single-speed
  "Ручна / Механіка": "manual",
  "Механіка": "manual",
  "Варіатор": "cvt",
  "Робот": "robot",
};
const DRIVE: Record<string, string> = {
  "Передній": "fwd",
  "Задній": "rwd",
  "Повний": "awd",
};

function pickEnum(map: Record<string, string>, value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (map[value]) return map[value];
  for (const [k, v] of Object.entries(map)) {
    if (value.includes(k)) return v;
  }
  return fallback;
}

async function processPhoto(filePath: string): Promise<Buffer> {
  const raw = await readFile(filePath);
  if (!CROP) return raw;
  const img = sharp(raw);
  const meta = await img.metadata();
  const h = meta.height ?? 0;
  const w = meta.width ?? 0;
  if (!h || !w) return raw;
  const cropTop = Math.round(h * WATERMARK_CROP_PCT);
  return img
    .extract({ left: 0, top: cropTop, width: w, height: h - cropTop })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function uploadPhoto(filePath: string, destPath: string): Promise<string> {
  const buf = await processPhoto(filePath);
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(destPath)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "image/jpeg",
    },
    body: new Uint8Array(buf),
  });
  if (!res.ok) throw new Error(`upload ${filePath}: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { downloadTokens: string };
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(
    destPath
  )}?alt=media&token=${json.downloadTokens}`;
}

async function wipeAllCars(): Promise<void> {
  const all: Array<{ id: number }> = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API}/cars?page=${page}&pageSize=100`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`list cars: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { data: Array<{ id: number }>; total: number };
    all.push(...j.data);
    if (all.length >= j.total || j.data.length === 0) break;
    page++;
  }
  console.log(`Wiping ${all.length} existing CRM cars…`);
  for (const c of all) {
    const res = await fetch(`${API}/cars/${c.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.ok) {
      process.stdout.write(`-${c.id} `);
    } else {
      console.error(`\n  delete #${c.id} failed: ${res.status} ${await res.text()}`);
    }
  }
  process.stdout.write("\n");
}

async function uploadAllPhotos(carDir: string, ts: number): Promise<string[]> {
  const photosDir = resolve(carDir, "photos");
  let files: string[] = [];
  try {
    files = (await readdir(photosDir))
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();
  } catch {
    return [];
  }
  const urls: string[] = [];
  for (const [i, f] of files.entries()) {
    const local = resolve(photosDir, f);
    const dest = `cars/${ts}/${String(i).padStart(3, "0")}_${f}`;
    try {
      const url = await uploadPhoto(local, dest);
      urls.push(url);
      process.stdout.write(".");
    } catch (e) {
      process.stdout.write("x");
      console.error(`\n  photo failed: ${(e as Error).message}`);
    }
  }
  process.stdout.write("\n");
  return urls;
}

function mapCar(s: Scraped, photoUrls: string[]) {
  const price = s.priceUsd ?? 0;
  const engineType = pickEnum(ENGINE, s.fuelType || s.engine?.split(",")[0], "gasoline");
  const bodyType = pickEnum(BODY, s.bodyType, "sedan");
  const gearboxType = pickEnum(GEARBOX, s.gearbox, "automatic");
  const drivetrain = pickEnum(DRIVE, s.drivetrain, "fwd");
  const engineVolume = engineType === "electric" ? 0 : (s.engineVolumeL ?? 0);
  const enginePower = s.enginePowerHp ?? 0;

  return {
    brand: s.brand ?? "Unknown",
    model: s.model ?? "Unknown",
    year: s.year ?? new Date().getFullYear(),
    mileage: s.mileageKm ?? 0,
    color: s.color ?? "—",
    vinNumber: s.vin ?? `RIA-${s.id}`,
    registrationNumber: `RIA-${s.id}`,
    countryOfRegistration: "Україна",

    engineType,
    engineVolume,
    enginePower,
    gearboxType,
    drivetrain,

    bodyType,
    doorsCount: s.doors ?? 4,
    seatsCount: s.seats ?? 5,

    carOrigin: "US", // most are imported from USA per the listing filter (abroad=2, custom=3)
    carLocation: "dealership",
    location: s.location ?? "Львів",

    sellType: "retail",
    isCryptoAvailable: false,
    ownerPrice: price,
    dealerPrice: price,
    isAvailable: true,
    listingStatus: "available",

    shortDescription: s.title ?? "",
    description: s.description ?? "",

    accidentFree: false,
    crashed: false,
    airbagReplaced: false,

    responsiblePerson: RESPONSIBLE,

    photos: photoUrls.map((url, idx) => ({ url, alt: `${s.title ?? "photo"} #${idx + 1}` })),
  };
}

async function createCar(payload: ReturnType<typeof mapCar>): Promise<{ ok: true; id: number } | { ok: false; status: number; body: string }> {
  const res = await fetch(`${API}/cars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (res.ok) {
    const j = JSON.parse(text) as { id: number };
    return { ok: true, id: j.id };
  }
  return { ok: false, status: res.status, body: text };
}

async function main() {
  if (WIPE && !DRY) await wipeAllCars();

  const entries = await readdir(SEED);
  const carDirs: string[] = [];
  for (const d of entries) {
    const p = resolve(SEED, d);
    if ((await stat(p)).isDirectory()) carDirs.push(p);
  }
  carDirs.sort();

  let processed = 0;
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const dir of carDirs) {
    if (processed >= LIMIT) break;
    processed++;
    const data = JSON.parse(await readFile(resolve(dir, "data.json"), "utf8")) as Scraped;
    console.log(`\n[${processed}] ${data.title} (RIA ${data.id}) — ${data.photos.length} photos`);

    if (DRY) {
      console.log(JSON.stringify(mapCar(data, []), null, 2));
      continue;
    }

    const photoUrls = await uploadAllPhotos(dir, data.id);
    console.log(`  uploaded ${photoUrls.length}/${data.photos.length} photos`);

    const payload = mapCar(data, photoUrls);
    const result = await createCar(payload);
    if (result.ok) {
      imported++;
      console.log(`  ✓ created CRM car #${result.id}`);
    } else if (result.status === 409) {
      skipped++;
      console.log(`  • skipped (VIN exists)`);
    } else {
      failed++;
      console.error(`  ✗ ${result.status}: ${result.body.slice(0, 400)}`);
    }
  }

  console.log(`\nDone. imported=${imported} skipped=${skipped} failed=${failed} total=${processed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
