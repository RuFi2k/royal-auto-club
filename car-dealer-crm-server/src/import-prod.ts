// One-off importer: loads production cars (exported to /app/prod_cars_full.json)
// into this CRM. Re-encrypts VIN/registration with the local ENCRYPTION_KEY,
// downloads every Firebase photo and re-uploads it to MinIO, and writes rows
// directly via Prisma (no Telegram side effects).
//
// Run:  docker exec royalautoclub-crm-server-1 npx tsx src/import-prod.ts
import { readFileSync } from "node:fs";
import { prisma } from "./db";
import { encrypt, hmac } from "./lib/encryption";
import { putObject } from "./lib/storage";

const SRC = "/app/prod_cars_full.json";

// Fields on the prod object that must not be written directly.
const DROP = new Set(["id", "vinNumberHash", "_photos", "_archives", "telegramMessageId", "photoUrl"]);
const DATE_FIELDS = ["soldAt", "eta", "priceChangedAt", "createdAt", "updatedAt"];

function extOf(url: string): string {
  const m = decodeURIComponent(url.split("?")[0]).match(/\.([a-z0-9]{2,5})$/i);
  return (m?.[1] ?? "webp").toLowerCase();
}

const cache = new Map<string, string>(); // firebase url -> minio url

async function migrateImage(url: string): Promise<string | null> {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url)!;
  const res = await fetch(url);
  if (!res.ok) { console.warn(`  ! download ${res.status} ${url.slice(0, 90)}`); return null; }
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "application/octet-stream";
  const key = `cars/photos/${Date.now()}_${Math.random().toString(36).slice(2)}.${extOf(url)}`;
  const minioUrl = await putObject(key, buf, ct);
  cache.set(url, minioUrl);
  return minioUrl;
}

async function main() {
  const cars: any[] = JSON.parse(readFileSync(SRC, "utf8"));
  console.log(`Loaded ${cars.length} production cars`);

  console.log("Wiping existing cars (cascades photos/archives)...");
  await prisma.carPhoto.deleteMany({});
  await prisma.carPhotoArchive.deleteMany({});
  await prisma.car.deleteMany({});

  let imgCount = 0;
  for (const pc of cars) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(pc)) {
      if (DROP.has(k)) continue;
      data[k] = DATE_FIELDS.includes(k) && typeof v === "string" ? new Date(v) : v;
    }
    // encrypt sensitive fields + uniqueness hash
    data.vinNumber = encrypt(pc.vinNumber);
    data.registrationNumber = encrypt(pc.registrationNumber);
    data.vinNumberHash = hmac(pc.vinNumber);
    data.telegramMessageId = null;

    // cover
    const cover = pc.photoUrl ? await migrateImage(pc.photoUrl) : null;
    if (cover) imgCount++;
    data.photoUrl = cover;

    const car = await prisma.car.create({ data: data as any });

    // gallery
    const photos = (pc._photos ?? []) as any[];
    for (const p of photos) {
      const u = await migrateImage(p.url);
      if (!u) continue;
      imgCount++;
      await prisma.carPhoto.create({
        data: { carId: car.id, url: u, alt: p.alt ?? null, sortOrder: p.sortOrder ?? 0 },
      });
    }
    console.log(`  car ${car.id}: ${pc.brand} ${pc.model} — ${photos.length} gallery + cover`);
  }
  console.log(`\nDone. Imported ${cars.length} cars, ${imgCount} images (${cache.size} unique) to MinIO.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
