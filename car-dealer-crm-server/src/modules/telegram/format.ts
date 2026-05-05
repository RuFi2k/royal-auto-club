import type { Car, CarPhoto, ListingStatus } from "@prisma/client";

const BODY_TYPE_UA: Record<string, string> = {
  sedan: "седан",
  suv: "позашляховик",
  crossover: "кросовер",
  hatchback: "хетчбек",
  coupe: "купе",
  wagon: "універсал",
  minivan: "мінівен",
  pickup: "пікап",
  van: "фургон",
  convertible: "кабріолет",
  liftback: "ліфтбек",
};

const ENGINE_TYPE_UA: Record<string, string> = {
  gasoline: "бензин",
  diesel: "дизель",
  electric: "електро",
  hybrid_gasoline: "гібрид (бензин)",
  hybrid_diesel: "гібрид (дизель)",
  gas: "газ",
  gasoline_gas: "бензин/газ",
};

const GEARBOX_UA: Record<string, string> = {
  manual: "механіка",
  automatic: "автомат",
  cvt: "варіатор",
  robot: "робот",
  dual_clutch: "робот (DSG)",
};

const DRIVETRAIN_UA: Record<string, string> = {
  fwd: "передній",
  rwd: "задній",
  awd: "повний",
  four_wd: "повний (4WD)",
};

const STATUS_HEADER: Record<ListingStatus, string> = {
  available: "✅ <b>В наявності</b>",
  upcoming: "🚚 <b>В дорозі</b>",
  sold: "🔴 <b>Продано</b>",
  archived: "",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatMileage(km: number): string {
  if (km >= 1000) {
    const thousands = Math.round(km / 1000);
    return `${thousands.toLocaleString("uk-UA")} тис. км`;
  }
  return `${km.toLocaleString("uk-UA")} км`;
}

function formatPrice(price: unknown): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return "Ціна за запитом";
  return `$${Math.round(n).toLocaleString("uk-UA").replace(/,/g, " ")}`;
}

function formatVolume(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toFixed(1)}L`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Telegram caption limit: 1024 chars (sendMediaGroup, editMessageCaption).
const CAPTION_MAX = 1024;

export function buildCarCaption(
  car: Car,
  opts: { siteUrl: string; descriptionBudget?: number } = { siteUrl: "" },
): string {
  const siteUrl = opts.siteUrl.replace(/\/+$/, "");
  const url = siteUrl ? `${siteUrl}/ua/cars/${car.id}` : "";

  const header = STATUS_HEADER[car.listingStatus] ?? "";
  const bodyTypeUa = BODY_TYPE_UA[car.bodyType] ?? car.bodyType;
  const titleLine = `<b>${car.year} ${escapeHtml(car.brand)} ${escapeHtml(car.model)} ${escapeHtml(bodyTypeUa)}</b>`;

  const engineLabel = [formatVolume(car.engineVolume), ENGINE_TYPE_UA[car.engineType] ?? car.engineType]
    .filter(Boolean)
    .join(" ");

  const specLines = [
    engineLabel ? `🛠 Двигун: ${escapeHtml(engineLabel)}` : "",
    Number.isFinite(car.enginePower) && car.enginePower > 0
      ? `🏎 Потужність: ${car.enginePower} к.с.`
      : "",
    Number.isFinite(car.mileage) && car.mileage > 0
      ? `🛣 Пробіг: ${formatMileage(car.mileage)}`
      : "",
    `⚙️ КПП: ${escapeHtml(GEARBOX_UA[car.gearboxType] ?? car.gearboxType)}`,
    `🚙 Привід: ${escapeHtml(DRIVETRAIN_UA[car.drivetrain] ?? car.drivetrain)}`,
    car.color ? `🎨 Колір: ${escapeHtml(car.color)}` : "",
  ].filter(Boolean);

  const priceLine = `💰 ${formatPrice(car.websitePrice)}`;
  const linkLines = url
    ? [`ℹ️ Повна інформація на сайті:`, url]
    : [];

  const fixed = [
    header,
    titleLine,
    "",
    "__DESC__",
    specLines.join("\n"),
    "",
    priceLine,
    linkLines.length ? "" : null,
    ...linkLines,
  ]
    .filter((x): x is string => typeof x === "string")
    .join("\n");

  // Budget the description against the caption limit.
  const fixedLen = fixed.replace("__DESC__", "").length;
  const descBudget = Math.max(0, CAPTION_MAX - fixedLen - 2);
  const rawDesc = stripHtml(car.shortDescription ?? car.description ?? "");
  const desc = rawDesc ? truncate(escapeHtml(rawDesc), descBudget) : "";

  const finalText = fixed.replace("__DESC__", desc);
  // Trim leading blank lines if status header was empty (archived path) or desc is empty.
  return finalText.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
}

export function pickPhotoUrls(photos: CarPhoto[], coverFallback: string | null): string[] {
  const sorted = [...photos].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
  const urls = sorted.map((p) => p.url);
  if (urls.length === 0 && coverFallback) urls.push(coverFallback);
  // Telegram media group: 2–10 items. Cap at 10.
  return urls.slice(0, 10);
}
