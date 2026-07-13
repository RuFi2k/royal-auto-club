// Scrape every car listing from a Royal Auto Club Auto.RIA page
// and dump per-car JSON + full-resolution photos into ./seed/<id>/.
//
// Run:  cd crm/car-dealer-crm-server && npx tsx scripts/scrape-autoria.ts

import * as cheerio from "cheerio";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const LISTING_URL =
  "https://auto.ria.com/uk/search/?indexName=auto&company_id=4004&custom=3&abroad=2&limit=100";
const SEED_DIR = resolve(__dirname, "../../seed");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type CarRecord = {
  id: number;
  url: string;
  scrapedAt: string;
  title?: string;
  brand?: string;
  model?: string;
  year?: number;
  mileageKm?: number;
  priceUsd?: number;
  priceUah?: number;
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
  registrationCountry?: string;
  importedFrom?: string;
  location?: string;
  description?: string;
  characteristics: Record<string, string>;
  photos: string[];
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "uk,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function extractListingUrls(html: string): string[] {
  const re = /\/uk\/auto_[a-z0-9_-]+_(\d{6,})\.html/gi;
  const matches = uniq(html.match(re) || []);
  return matches.map((p) => `https://auto.ria.com${p}`);
}

function idFromUrl(url: string): number {
  const m = url.match(/_(\d+)\.html/);
  return m ? Number(m[1]) : 0;
}

function intFrom(text: string | undefined | null): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : undefined;
}

function floatFrom(text: string | undefined | null): number | undefined {
  if (!text) return undefined;
  const m = text.replace(/,/g, ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

function parseDetail(html: string, url: string): CarRecord {
  const $ = cheerio.load(html);
  const id = idFromUrl(url);

  const title = $("h1").first().text().trim() || $("title").text().trim();

  // Title pattern: "Audi A7 Sportback 2018", "Land Rover Range Rover Evoque 2020"
  let brand: string | undefined;
  let model: string | undefined;
  let year: number | undefined;
  const yearMatch = title.match(/^(.+?)\s+(\d{4})\b/);
  if (yearMatch) {
    const beforeYear = yearMatch[1];
    year = Number(yearMatch[2]);
    const MULTI_WORD_BRANDS = [
      "Land Rover",
      "Alfa Romeo",
      "Aston Martin",
      "Rolls-Royce",
      "Great Wall",
      "Iran Khodro",
    ];
    const matched = MULTI_WORD_BRANDS.find((b) => beforeYear.startsWith(b + " "));
    if (matched) {
      brand = matched;
      model = beforeYear.slice(matched.length + 1);
    } else {
      const i = beforeYear.indexOf(" ");
      brand = i === -1 ? beforeYear : beforeYear.slice(0, i);
      model = i === -1 ? "" : beforeYear.slice(i + 1);
    }
  }

  // Build a "rendered text" view: replace every tag with `|`, then collapse.
  // Result: |...|Двигун|Бензин, 3 л, (462.4 к.с. / 340 кВт)|Коробка передач|Автомат|...
  const segments = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "|")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .split("|")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Find the value that immediately follows a known label.
  const after = (label: string): string | undefined => {
    const i = segments.findIndex((s) => s === label);
    if (i === -1 || i + 1 >= segments.length) return undefined;
    return segments[i + 1];
  };

  // Prices come from embedded JSON state (rendered as `\"priceUSD\":41990`)
  const priceUsd = intFrom(html.match(/priceUSD\\?":\s*(\d+)/)?.[1]);
  const priceUah = intFrom(html.match(/priceUAH\\?":\s*(\d+)/)?.[1]);

  const engineRaw = after("Двигун");
  const fuelType = engineRaw?.split(",")[0]?.trim();
  const engineVolumeL = floatFrom(engineRaw?.match(/(\d+(?:[.,]\d+)?)\s*л/)?.[1]);
  const enginePowerHp = (() => {
    const m = engineRaw?.match(/(\d+(?:[.,]\d+)?)\s*к\.?\s*с/);
    return m ? Math.round(Number(m[1].replace(",", "."))) : undefined;
  })();

  const gearbox = after("Коробка передач");
  const drivetrain = after("Привід");
  const color = after("Колір");

  // Body / doors / seats live on a "BodyType • N дверей • M місць" line in the description block.
  const bdsLine = segments.find((s) => /\d+\s*двер(?:ей|і|ні)/.test(s) && /\d+\s*місц/.test(s));
  const bodyType =
    after("Кузов") ||
    after("Тип кузова") ||
    bdsLine?.split(/\s*•\s*/)[0]?.trim();
  const doors = intFrom(
    bdsLine?.match(/(\d+)\s*двер/)?.[1] || after("Дверей") || after("Кількість дверей")
  );
  const seats = intFrom(
    bdsLine?.match(/(\d+)\s*місц/)?.[1] || after("Місць") || after("Кількість місць")
  );

  // Mileage: title or "Пробіг" — appears as "80 тис. км" near header
  const mileageMatch = html.match(/(\d+)\s*тис\.\s*км/);
  const mileageKm = mileageMatch ? Number(mileageMatch[1]) * 1000 : undefined;

  // VIN — look in rendered text (often shown after "VIN-код")
  const bodyText = segments.join(" | ");
  const vin =
    bodyText.match(/VIN[-\s]*код[^A-HJ-NPR-Z0-9]{0,5}([A-HJ-NPR-Z0-9*]{11,17})/i)?.[1] ||
    after("VIN-код") ||
    after("VIN");

  const registrationCountry =
    after("Країна реєстрації") || after("Країна походження");
  const importedFrom = after("Розмитнення") || after("Привезено з");
  const location =
    after("Місто") || after("Місто реєстрації") || after("Регіон") ||
    bodyText.match(/(Львів|Київ|Одеса|Харків|Дніпро|Запоріжжя|Луцьк|Тернопіль|Івано-Франківськ|Ужгород|Чернівці)[^|]{0,100}/)?.[0]?.trim();

  // Long description — look for a typical "Опис" block
  let description = "";
  const descIdx = segments.findIndex((s) => s === "Опис" || s === "Опис від продавця");
  if (descIdx !== -1) {
    description = segments
      .slice(descIdx + 1, descIdx + 30)
      .filter((s) => s.length > 20)
      .join("\n")
      .trim();
  }

  // Capture full set of label→value pairs for any field we missed.
  const characteristics: Record<string, string> = {};
  const knownLabels = [
    "Двигун", "Коробка передач", "Привід", "Колір", "Кузов", "Тип кузова",
    "Дверей", "Місць", "VIN-код", "VIN", "Країна реєстрації", "Розмитнення",
    "Місто", "Регіон", "Стан", "Покоління", "Модифікація", "Об'єм двигуна",
    "Тип палива", "Витрата палива", "Привезений з", "Розташування",
  ];
  for (const label of knownLabels) {
    const v = after(label);
    if (v && !characteristics[label]) characteristics[label] = v;
  }

  // Photos: all unique fx.jpg URLs that share the slug prefix from this URL
  const allPhotos = uniq(
    Array.from(html.matchAll(/https:\/\/cdn\d+\.riastatic\.com\/photosnew\/auto\/photo\/[^"'\s]+fx\.jpg/g)).map(
      (m) => m[0]
    )
  );
  // Filter to this listing only — group by image base id (the long number after `__`)
  // and keep only those whose slug prefix appears most often (the listing's own).
  const slugCounts = new Map<string, number>();
  for (const u of allPhotos) {
    const m = u.match(/\/photo\/([a-z0-9_-]+?)__\d+fx\.jpg/i);
    if (!m) continue;
    slugCounts.set(m[1], (slugCounts.get(m[1]) || 0) + 1);
  }
  let bestSlug = "";
  let bestCount = 0;
  for (const [s, c] of slugCounts) {
    if (c > bestCount) {
      bestCount = c;
      bestSlug = s;
    }
  }
  const photos = bestSlug
    ? allPhotos.filter((u) => u.includes(`/photo/${bestSlug}__`))
    : allPhotos;

  return {
    id,
    url,
    scrapedAt: new Date().toISOString(),
    title,
    brand,
    model,
    year,
    mileageKm,
    priceUsd,
    priceUah,
    color,
    bodyType,
    engine: engineRaw,
    enginePowerHp,
    engineVolumeL,
    fuelType,
    gearbox,
    drivetrain,
    doors,
    seats,
    vin,
    registrationCountry,
    importedFrom,
    location,
    description,
    characteristics,
    photos,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok || !res.body) {
    console.warn(`  ! photo failed (${res.status}): ${url}`);
    return;
  }
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(res.body as any, createWriteStream(dest));
}

async function downloadPhotos(car: CarRecord): Promise<void> {
  const dir = resolve(SEED_DIR, String(car.id), "photos");
  await mkdir(dir, { recursive: true });
  let i = 1;
  for (const url of car.photos) {
    const ext = url.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || "jpg";
    const dest = resolve(dir, `${String(i).padStart(3, "0")}.${ext}`);
    await downloadFile(url, dest);
    i++;
  }
}

// Walk every results page (&page=N) until a page yields no new listings.
// Auto.RIA caps the first page at ~20 regardless of `limit`, so pagination is
// required to capture the full company inventory.
async function collectAllDetailUrls(): Promise<string[]> {
  const seen = new Set<string>();
  for (let page = 0; page < 25; page++) {
    const url = `${LISTING_URL}&page=${page}`;
    const html = await fetchHtml(url);
    const urls = extractListingUrls(html);
    const before = seen.size;
    for (const u of urls) seen.add(u);
    console.log(`  page ${page}: ${urls.length} urls (total ${seen.size})`);
    if (seen.size === before) break; // no new cars — past the last page
    await sleep(800);
  }
  return [...seen];
}

async function main() {
  console.log(`Fetching listing (paginated): ${LISTING_URL}`);
  let detailUrls = await collectAllDetailUrls();
  // ONLY_IDS=39807057,39807554,... restricts the scrape to specific listings
  // (used to backfill missing cars without re-downloading the whole inventory).
  const onlyIds = process.env.ONLY_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (onlyIds?.length) {
    detailUrls = detailUrls.filter((u) => onlyIds.includes(String(idFromUrl(u))));
    console.log(`ONLY_IDS set — scraping ${detailUrls.length} of them`);
  }
  console.log(`Found ${detailUrls.length} detail URLs`);

  await mkdir(SEED_DIR, { recursive: true });
  const summary: Array<Pick<CarRecord, "id" | "url" | "title" | "priceUsd" | "photos">> = [];

  for (const [idx, url] of detailUrls.entries()) {
    console.log(`\n[${idx + 1}/${detailUrls.length}] ${url}`);
    if (idx > 0) await sleep(1500);
    try {
      let html = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          html = await fetchHtml(url);
          break;
        } catch (e) {
          if (attempt === 2) throw e;
          console.warn(`  retry ${attempt + 1}: ${(e as Error).message}`);
          await sleep(5000 * (attempt + 1));
        }
      }
      const car = parseDetail(html, url);
      console.log(`  ${car.title} — $${car.priceUsd ?? "?"} — ${car.photos.length} photos`);

      const carDir = resolve(SEED_DIR, String(car.id));
      await mkdir(carDir, { recursive: true });
      await writeFile(
        resolve(carDir, "data.json"),
        JSON.stringify(car, null, 2),
        "utf8"
      );
      await writeFile(resolve(carDir, "page.html"), html, "utf8");
      await downloadPhotos(car);

      summary.push({
        id: car.id,
        url: car.url,
        title: car.title,
        priceUsd: car.priceUsd,
        photos: car.photos,
      });
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`);
    }
  }

  // When backfilling specific ids, merge into the existing index instead of
  // replacing it (so the other already-scraped cars stay in the manifest).
  let cars = summary;
  if (onlyIds?.length) {
    try {
      const prev = JSON.parse(await readFile(resolve(SEED_DIR, "index.json"), "utf8")).cars ?? [];
      const byId = new Map<number, (typeof summary)[number]>();
      for (const c of [...prev, ...summary]) byId.set(c.id, c);
      cars = [...byId.values()];
    } catch { /* no prior index — write just the new ones */ }
  }
  await writeFile(
    resolve(SEED_DIR, "index.json"),
    JSON.stringify(
      { source: LISTING_URL, scrapedAt: new Date().toISOString(), count: cars.length, cars },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\nDone. Wrote ${summary.length} new cars; index now has ${cars.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
