// One-off importer: loads scraped Auto.RIA seed cars (mounted at /app/seed)
// into the CRM via Prisma DIRECTLY — no API, so syncCarTelegramPost is NEVER
// called and the Telegram channel is not touched. Wipes existing cars first.
//
// Photos are watermark-cropped (top 8%), optimized to webp, uploaded to MinIO.
// VIN/registration are encrypted; vinNumberHash set for uniqueness.
//
// Run:  docker exec royalautoclub-crm-server-1 npx tsx src/import-seed.ts [--dry]
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { prisma } from "./db";
import { encrypt, hmac } from "./lib/encryption";
import { putObject } from "./lib/storage";

const SEED = "/app/seed";
const RESPONSIBLE = "maxplayer3@gmail.com";
const WATERMARK_CROP_PCT = 0.08;
const MAX_DIMENSION = 1920;
const DRY = process.argv.includes("--dry");

type Scraped = {
  id: number;
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
  "Бензин": "gasoline", "Дизель": "diesel", "Електро": "electric",
  "Гібрид": "hybrid_gasoline", "Гібрид (HEV)": "hybrid_gasoline", "Гібрид (PHEV)": "hybrid_gasoline",
  "Газ": "gas", "Газ/Бензин": "gasoline_gas", "Бензин/Газ": "gasoline_gas",
};
const BODY: Record<string, string> = {
  "Седан": "sedan", "Позашляховик / Кросовер": "suv", "Позашляховик": "suv", "Кросовер": "crossover",
  "Хетчбек": "hatchback", "Купе": "coupe", "Універсал": "wagon", "Мінівен": "minivan",
  "Пікап": "pickup", "Фургон": "van", "Кабріолет": "convertible", "Ліфтбек": "liftback",
};
const GEARBOX: Record<string, string> = {
  "Автомат": "automatic", "Типтронік": "automatic", "Редуктор": "automatic",
  "Ручна / Механіка": "manual", "Механіка": "manual", "Варіатор": "cvt", "Робот": "robot",
};
const DRIVE: Record<string, string> = {
  "Передній": "fwd", "Задній": "rwd", "Повний": "awd",
};

function pickEnum(map: Record<string, string>, value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (map[value]) return map[value];
  for (const [k, v] of Object.entries(map)) if (value.includes(k)) return v;
  return fallback;
}

async function processPhoto(filePath: string): Promise<Buffer> {
  const raw = await readFile(filePath);
  const img = sharp(raw);
  const meta = await img.metadata();
  const h = meta.height ?? 0, w = meta.width ?? 0;
  let pipe = img;
  if (h && w) {
    const cropTop = Math.round(h * WATERMARK_CROP_PCT);
    pipe = sharp(await img.extract({ left: 0, top: cropTop, width: w, height: h - cropTop }).toBuffer());
  }
  return pipe
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

async function uploadCarPhotos(carDir: string): Promise<string[]> {
  const photosDir = resolve(carDir, "photos");
  let files: string[] = [];
  try {
    files = (await readdir(photosDir)).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
  } catch { return []; }
  const urls: string[] = [];
  for (const f of files) {
    try {
      const buf = await processPhoto(resolve(photosDir, f));
      const key = `cars/photos/${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
      urls.push(await putObject(key, buf, "image/webp"));
      process.stdout.write(".");
    } catch (e) {
      process.stdout.write("x");
      console.error(`\n  photo ${f} failed: ${(e as Error).message}`);
    }
  }
  process.stdout.write("\n");
  return urls;
}

function mapCar(s: Scraped) {
  const price = s.priceUsd ?? 0;
  const engineType = pickEnum(ENGINE, s.fuelType || s.engine?.split(",")[0], "gasoline");
  const engineVolume = engineType === "electric" ? 0 : (s.engineVolumeL ?? 0);
  return {
    brand: s.brand ?? "Unknown",
    model: s.model ?? "Unknown",
    year: s.year ?? new Date().getFullYear(),
    mileage: s.mileageKm ?? 0,
    color: s.color ?? "—",
    countryOfRegistration: "Україна",
    engineType, engineVolume, enginePower: s.enginePowerHp ?? 0,
    gearboxType: pickEnum(GEARBOX, s.gearbox, "automatic"),
    drivetrain: pickEnum(DRIVE, s.drivetrain, "fwd"),
    bodyType: pickEnum(BODY, s.bodyType, "sedan"),
    doorsCount: s.doors ?? 4,
    seatsCount: s.seats ?? 5,
    carOrigin: "US",
    carLocation: "dealership",
    location: s.location ?? "Львів",
    sellType: "retail",
    isCryptoAvailable: false,
    ownerPrice: price, dealerPrice: price,
    isAvailable: true,
    listingStatus: "available",
    shortDescription: s.title ?? "",
    description: s.description ?? "",
    accidentFree: false, crashed: false, airbagReplaced: false,
    responsiblePerson: RESPONSIBLE,
  } as const;
}

async function main() {
  // ONLY_IDS=... imports just those cars and SKIPS the wipe (additive backfill).
  const only = process.env.ONLY_IDS?.split(",").map((s) => Number(s.trim())).filter(Boolean);
  const all: number[] = JSON.parse(await readFile(resolve(SEED, "index.json"), "utf8"))
    .cars.map((c: { id: number }) => c.id);
  const ids = only?.length ? all.filter((id) => only.includes(id)) : all;
  console.log(`Seed cars to import: ${ids.length}${only?.length ? " (additive, no wipe)" : ""}`);

  if (DRY) {
    for (const id of ids) {
      const s = JSON.parse(await readFile(resolve(SEED, String(id), "data.json"), "utf8")) as Scraped;
      const m = mapCar(s);
      console.log(`${id} ${m.brand} ${m.model} ${m.year} $${m.dealerPrice} ${m.engineType}/${m.bodyType}/${m.drivetrain} ${s.photos.length}ph`);
    }
    console.log("DRY run — nothing written.");
    await prisma.$disconnect();
    return;
  }

  if (only?.length) {
    console.log("Additive mode — keeping existing cars.");
  } else {
    console.log("Wiping existing cars (cascades photos/archives)...");
    await prisma.carPhoto.deleteMany({});
    await prisma.carPhotoArchive.deleteMany({});
    const del = await prisma.car.deleteMany({});
    console.log(`  deleted ${del.count} cars`);
  }

  let imported = 0, imgCount = 0;
  for (const id of ids) {
    const s = JSON.parse(await readFile(resolve(SEED, String(id), "data.json"), "utf8")) as Scraped;
    console.log(`\n[${imported + 1}/${ids.length}] ${s.title} (RIA ${id}) — ${s.photos.length} photos`);
    const data = mapCar(s);
    const vin = s.vin ?? `RIA-${id}`;
    const reg = `RIA-${id}`;
    const urls = await uploadCarPhotos(resolve(SEED, String(id)));
    imgCount += urls.length;

    const car = await prisma.car.create({
      data: {
        ...data,
        vinNumber: encrypt(vin),
        vinNumberHash: hmac(vin),
        registrationNumber: encrypt(reg),
        photoUrl: urls[0] ?? null,
        telegramMessageId: null,
      } as any,
    });
    for (const [idx, url] of urls.entries()) {
      await prisma.carPhoto.create({ data: { carId: car.id, url, alt: `${s.title ?? "photo"} #${idx + 1}`, sortOrder: idx } });
    }
    imported++;
    console.log(`  ✓ car #${car.id} — ${urls.length}/${s.photos.length} photos`);
  }
  console.log(`\nDone. imported=${imported} images=${imgCount}. No Telegram posts (Prisma-direct).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
