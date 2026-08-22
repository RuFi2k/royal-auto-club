import type { AuditAction, AuditLogEntry } from "../services/audit.api";

export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Створено авто",
  UPDATE: "Змінено авто",
  DELETE: "Видалено авто",
  AVAILABILITY_CHANGE: "Статус продажу",
  PHOTO_ADD: "Додано фото",
  PHOTO_DELETE: "Видалено фото",
  PHOTO_REORDER: "Порядок фото",
  TELEGRAM_PUBLISH: "Telegram: публікація",
  TELEGRAM_DELETE: "Telegram: видалення",
  AUTORIA_PUBLISH: "AUTO.RIA: публікація",
  AUTORIA_DELETE: "AUTO.RIA: видалення",
  USER_APPROVE: "Схвалено користувача",
  USER_DISABLE: "Заблоковано користувача",
  USER_ENABLE: "Розблоковано користувача",
  USER_DELETE: "Видалено користувача",
  USER_ROLE_CHANGE: "Змінено роль",
  LOGIN: "Вхід",
  LOGOUT: "Вихід",
};

// Drives the badge colour: green = created/published, red = destructive.
export const ACTION_TONE: Record<AuditAction, "good" | "bad" | "warn" | "neutral"> = {
  CREATE: "good",
  UPDATE: "warn",
  DELETE: "bad",
  AVAILABILITY_CHANGE: "warn",
  PHOTO_ADD: "good",
  PHOTO_DELETE: "bad",
  PHOTO_REORDER: "neutral",
  TELEGRAM_PUBLISH: "good",
  TELEGRAM_DELETE: "bad",
  AUTORIA_PUBLISH: "good",
  AUTORIA_DELETE: "bad",
  USER_APPROVE: "good",
  USER_DISABLE: "bad",
  USER_ENABLE: "good",
  USER_DELETE: "bad",
  USER_ROLE_CHANGE: "warn",
  LOGIN: "neutral",
  LOGOUT: "neutral",
};

const FIELD_LABELS: Record<string, string> = {
  brand: "Марка", model: "Модель", year: "Рік", mileage: "Пробіг",
  color: "Колір", vinNumber: "VIN", registrationNumber: "Держномер",
  countryOfRegistration: "Країна реєстрації",
  engineType: "Тип двигуна", engineVolume: "Обʼєм двигуна", enginePower: "Потужність",
  gearboxType: "КПП", drivetrain: "Привід",
  bodyType: "Кузов", doorsCount: "Дверей", seatsCount: "Місць",
  carOrigin: "Походження", carLocation: "Місцезнаходження", location: "Адреса",
  sellType: "Тип продажу", isCryptoAvailable: "Оплата криптою",
  ownerPrice: "Ціна власника", dealerPrice: "Ціна продажу",
  estimatedPrice: "Орієнтовна ціна",
  isAvailable: "В наявності", soldAt: "Дата продажу",
  listingStatus: "Статус", eta: "Очікуване прибуття", transitStage: "Етап доставки",
  shortDescription: "Короткий опис", description: "Опис",
  accidentFree: "Без ДТП", crashed: "Був у ДТП", airbagReplaced: "Заміна подушок",
  crashDetails: "Деталі ДТП", crashBodyParts: "Пошкоджені деталі",
  responsiblePerson: "Відповідальний",
  photoUrl: "Обкладинка", techPassportUrl: "Техпаспорт", defectsCheckUrl: "Дефектовка",
};

const VALUE_LABELS: Record<string, string> = {
  draft: "чернетка", upcoming: "в дорозі", available: "в наявності",
  sold: "продано", archived: "в архіві",
  ordered: "замовлено", in_transit: "в дорозі", at_port: "в порту",
  customs: "розмитнення", ready: "готово",
  admin: "адмін", manager: "менеджер",
  true: "так", false: "ні",
};

const PRICE_FIELDS = new Set(["ownerPrice", "dealerPrice", "estimatedPrice"]);

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "так" : "ні";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  const raw = String(value);
  if (PRICE_FIELDS.has(key)) {
    const n = Number(raw);
    if (Number.isFinite(n)) return `$${n.toLocaleString("uk-UA")}`;
  }
  // ISO timestamps → a readable date.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("uk-UA");
  }
  if (raw.length > 60) return `${raw.slice(0, 60)}…`;
  return VALUE_LABELS[raw] ?? raw;
}

function isDiff(v: unknown): v is { from: unknown; to: unknown } {
  return typeof v === "object" && v !== null && "from" in v && "to" in v;
}

// Turns a stored changedFields blob into one readable Ukrainian line.
export function describeChanges(entry: AuditLogEntry): string {
  const fields = entry.changedFields;
  if (!fields || typeof fields !== "object") return "—";

  switch (entry.action) {
    case "CREATE":
    case "DELETE": {
      const { brand, model, year } = fields as Record<string, unknown>;
      return [brand, model, year].filter(Boolean).join(" ") || "—";
    }
    case "PHOTO_ADD":
    case "PHOTO_DELETE":
      return fields.photoId ? `фото #${fields.photoId}` : "—";
    case "PHOTO_REORDER":
      return fields.count ? `${fields.count} фото` : "—";
    case "AUTORIA_PUBLISH":
      return fields.adId ? `оголошення ${fields.adId}` : "—";
    case "LOGIN":
      return fields.ip ? `IP ${fields.ip}` : "—";
    case "USER_APPROVE":
    case "USER_DISABLE":
    case "USER_ENABLE":
    case "USER_DELETE":
      return String(fields.target ?? "—");
    case "USER_ROLE_CHANGE": {
      const role = fields.role;
      const target = String(fields.target ?? "");
      if (isDiff(role)) {
        return `${target}: ${formatValue("role", role.from)} → ${formatValue("role", role.to)}`;
      }
      return target || "—";
    }
    default:
      break;
  }

  // UPDATE / AVAILABILITY_CHANGE: render the field-level diff.
  const parts = Object.entries(fields as Record<string, unknown>)
    .filter(([, v]) => isDiff(v))
    .map(([key, v]) => {
      const { from, to } = v as { from: unknown; to: unknown };
      return `${fieldLabel(key)}: ${formatValue(key, from)} → ${formatValue(key, to)}`;
    });

  return parts.length ? parts.join("; ") : "—";
}
