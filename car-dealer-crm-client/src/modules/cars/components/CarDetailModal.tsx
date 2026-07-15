import { useState } from "react";
import type { Car } from "../types/car.types";
import { CRASH_BODY_PART_LABELS } from "../lib/crash-body-parts";
import { publishCarToTelegram, deleteCarTelegramPost, publishCarToAutoRia, deleteCarAutoRiaAd } from "../services/cars.api";

interface Props {
  car: Car;
  onClose: () => void;
  onEdit: (car: Car) => void;
  onUpdated?: (car: Car) => void;
}

function fmt(value: number) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ENGINE_TYPE: Record<string, string> = {
  gasoline: "Бензин", diesel: "Дизель", electric: "Електро",
  hybrid_gasoline: "Гібрид (бензин)", hybrid_diesel: "Гібрид (дизель)",
  gas: "Газ", gasoline_gas: "Бензин + газ",
};
const GEARBOX_TYPE: Record<string, string> = {
  automatic: "Автомат", manual: "Механіка", cvt: "Варіатор",
  robot: "Робот", dual_clutch: "Подвійне зчеплення",
};
const DRIVETRAIN: Record<string, string> = {
  fwd: "Передній (FWD)", rwd: "Задній (RWD)", awd: "Повний (AWD)", four_wd: "Повний (4WD)",
};
const BODY_TYPE: Record<string, string> = {
  sedan: "Седан", suv: "Позашляховик", crossover: "Кросовер", hatchback: "Хетчбек",
  coupe: "Купе", wagon: "Універсал", minivan: "Мінівен", pickup: "Пікап",
  van: "Фургон", convertible: "Кабріолет", liftback: "Ліфтбек",
};
const CAR_ORIGIN: Record<string, string> = {
  EU: "ЄС", US: "США", canada: "Канада", korea: "Корея", japan: "Японія", china: "Китай", other: "Інше",
};
const CAR_LOCATION: Record<string, string> = {
  dealership: "Площадка", owner: "Власник",
};
const SELL_TYPE: Record<string, string> = {
  retail: "Роздріб", wholesale: "Гурт", auction: "Аукціон", consignment: "Консигнація",
};

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

export function CarDetailModal({ car, onClose, onEdit, onUpdated }: Props) {
  const [tgBusy, setTgBusy] = useState<"publish" | "delete" | null>(null);
  const [tgError, setTgError] = useState<string | null>(null);
  const [riaBusy, setRiaBusy] = useState<"publish" | "delete" | null>(null);
  const [riaError, setRiaError] = useState<string | null>(null);
  const isSold = car.listingStatus === "sold";
  const cannotPublish = car.listingStatus === "draft" || car.listingStatus === "archived";
  const riaDisabled = cannotPublish || isSold;

  async function handlePublish() {
    if (cannotPublish) return;
    if (car.telegramMessageId) {
      const ok = window.confirm("Перепублікувати пост у Telegram?\nСтарий пост буде видалено, новий — створено.");
      if (!ok) return;
    }
    setTgError(null);
    setTgBusy("publish");
    try {
      const { messageId } = await publishCarToTelegram(car.id);
      onUpdated?.({ ...car, telegramMessageId: messageId });
    } catch (err: any) {
      setTgError(err.message ?? "Не вдалося опублікувати");
    } finally {
      setTgBusy(null);
    }
  }

  async function handleDeletePost() {
    const ok = window.confirm("Видалити пост у Telegram?");
    if (!ok) return;
    setTgError(null);
    setTgBusy("delete");
    try {
      await deleteCarTelegramPost(car.id);
      onUpdated?.({ ...car, telegramMessageId: null });
    } catch (err: any) {
      setTgError(err.message ?? "Не вдалося видалити");
    } finally {
      setTgBusy(null);
    }
  }

  async function handleRiaPublish() {
    if (riaDisabled) return;
    if (car.autoriaAdId) {
      const ok = window.confirm("Перепублікувати оголошення на AUTO.RIA?\nСтаре оголошення буде видалено, нове — створено.");
      if (!ok) return;
    }
    setRiaError(null);
    setRiaBusy("publish");
    try {
      const { adId } = await publishCarToAutoRia(car.id);
      onUpdated?.({ ...car, autoriaAdId: adId });
    } catch (err: any) {
      setRiaError(err.message ?? "Не вдалося опублікувати");
    } finally {
      setRiaBusy(null);
    }
  }

  async function handleRiaDelete() {
    const ok = window.confirm("Видалити оголошення на AUTO.RIA?");
    if (!ok) return;
    setRiaError(null);
    setRiaBusy("delete");
    try {
      await deleteCarAutoRiaAd(car.id);
      onUpdated?.({ ...car, autoriaAdId: null });
    } catch (err: any) {
      setRiaError(err.message ?? "Не вдалося видалити");
    } finally {
      setRiaBusy(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-detail">
        <div className="modal-header">
          <div className="detail-header-title">
            <span className="car-brand">{car.brand}</span>
            <span className="car-model">{car.model}</span>
            <span className="car-row-id">#{car.id}</span>
            <span className={`badge ${car.listingStatus === "draft" ? "badge-draft" : car.isAvailable ? "badge-available" : "badge-unavailable"}`}>
              {car.listingStatus === "draft"
                ? "Чернетка"
                : car.listingStatus === "upcoming"
                ? "Очікується"
                : car.listingStatus === "archived"
                  ? "Архів"
                  : car.isAvailable
                    ? "Наявний"
                    : "Продано"}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body detail-body">

          {car.photoUrl && (
            <img src={car.photoUrl} alt={`${car.brand} ${car.model}`} className="detail-photo" />
          )}

          <div className="detail-section">
            <h3 className="detail-section-title">Основна інформація</h3>
            <div className="detail-grid">
              <Field label="Рік" value={car.year} />
              <Field label="Пробіг" value={`${car.mileage} тис. км`} />
              <Field label="Колір" value={car.color} />
              <Field label="VIN-номер" value={car.vinNumber} />
              <Field label="Реєстраційний номер" value={car.registrationNumber} />
              <Field label="Країна реєстрації" value={car.countryOfRegistration} />
            </div>
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">Двигун і трансмісія</h3>
            <div className="detail-grid">
              <Field label="Тип двигуна" value={ENGINE_TYPE[car.engineType] ?? car.engineType} />
              <Field label="Об'єм" value={`${car.engineVolume} л`} />
              <Field label="Потужність" value={`${car.enginePower} к.с.`} />
              <Field label="КПП" value={GEARBOX_TYPE[car.gearboxType] ?? car.gearboxType} />
              <Field label="Привід" value={DRIVETRAIN[car.drivetrain] ?? car.drivetrain} />
            </div>
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">Кузов і салон</h3>
            <div className="detail-grid">
              <Field label="Тип кузова" value={BODY_TYPE[car.bodyType] ?? car.bodyType} />
              <Field label="Дверей" value={car.doorsCount} />
              <Field label="Місць" value={car.seatsCount} />
            </div>
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">Статус і логістика</h3>
            <div className="detail-grid">
              <Field label="Походження" value={CAR_ORIGIN[car.carOrigin] ?? car.carOrigin} />
              <Field label="Розташування" value={CAR_LOCATION[car.carLocation] ?? car.carLocation} />
              <Field label="Адреса" value={car.location} />
            </div>
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">Ціноутворення</h3>
            <div className="detail-grid">
              <Field label="Тип продажу" value={SELL_TYPE[car.sellType] ?? car.sellType} />
              <Field label="Ціна власника" value={fmt(car.ownerPrice)} />
              <Field label="Ціна для дилерів" value={fmt(car.dealerPrice)} />
              {car.isCryptoAvailable && <Field label="Оплата" value="Криптовалюта доступна" />}
            </div>
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">Управління</h3>
            <div className="detail-grid">
              <Field label="Відповідальна особа" value={car.responsiblePerson} />
              <Field label="Додано" value={fmtDate(car.createdAt)} />
              <Field label="Оновлено" value={fmtDate(car.updatedAt)} />
              {car.priceChangedAt && <Field label="Ціна оновлена" value={fmtDate(car.priceChangedAt)} />}
            </div>
          </div>

          {car.listingStatus === "upcoming" && (
            <div className="detail-section">
              <h3 className="detail-section-title">Логістика</h3>
              <div className="detail-grid">
                {car.eta && (
                  <Field
                    label="Очікуване прибуття"
                    value={new Date(car.eta).toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" })}
                  />
                )}
                {car.transitStage && (
                  <Field
                    label="Етап"
                    value={
                      ({
                        ordered: "Замовлено",
                        in_transit: "В дорозі",
                        at_port: "У порту",
                        customs: "Розмитнення",
                        ready: "Готове",
                      } as Record<string, string>)[car.transitStage] ?? car.transitStage
                    }
                  />
                )}
                {car.estimatedPrice != null && (
                  <Field label="Орієнтовна ціна" value={fmt(car.estimatedPrice)} />
                )}
              </div>
            </div>
          )}

          {(car.shortDescription || car.description) && (
            <div className="detail-section">
              <h3 className="detail-section-title">Опис</h3>
              {car.shortDescription && (
                <p style={{ fontSize: 14, color: "#cbd5e1", margin: "0 0 12px" }}>
                  {car.shortDescription}
                </p>
              )}
              {car.description && (
                <div
                  className="detail-rich"
                  // Server-side sanitized via sanitize-html (allowlist-based) before save.
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: car.description }}
                />
              )}
            </div>
          )}

          {(car.crashed || car.accidentFree) && (
            <div className="detail-section">
              <h3 className="detail-section-title">Історія ремонту</h3>
              {car.accidentFree && !car.crashed && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.4)",
                    color: "#86efac",
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🛡</span>
                  <span>Без ДТП — підтверджено власником</span>
                </div>
              )}

              {car.crashed && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: "rgba(250,204,21,0.08)",
                    border: "1px solid rgba(250,204,21,0.35)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#fbbf24", fontWeight: 600, fontSize: 13 }}>
                    ⚠ Був у ДТП / були ремонти
                  </div>

                  {car.crashBodyParts.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                        Пошкоджені зони
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {car.crashBodyParts.map((p) => (
                          <span
                            key={p}
                            style={{
                              background: "#15151f",
                              border: "1px solid #2a2a3a",
                              color: "#e2e8f0",
                              borderRadius: 999,
                              padding: "3px 9px",
                              fontSize: 12,
                            }}
                          >
                            {(CRASH_BODY_PART_LABELS as Record<string, string>)[p] ?? p}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 9px",
                      borderRadius: 6,
                      fontSize: 12,
                      background: car.airbagReplaced ? "rgba(250,204,21,0.15)" : "#15151f",
                      border: `1px solid ${car.airbagReplaced ? "rgba(250,204,21,0.4)" : "#2a2a3a"}`,
                      color: car.airbagReplaced ? "#fbbf24" : "#94a3b8",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: car.airbagReplaced ? "#fbbf24" : "#22c55e",
                      }}
                    />
                    {car.airbagReplaced ? "Подушки замінювали" : "Подушки цілі"}
                  </div>

                  {car.crashDetails && (
                    <p style={{ marginTop: 12, fontSize: 13, color: "#cbd5e1", whiteSpace: "pre-line" }}>
                      {car.crashDetails}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {(car.techPassportUrl || car.defectsCheckUrl) && (
            <div className="detail-section">
              <h3 className="detail-section-title">Документи</h3>
              <div className="detail-docs">
                {car.techPassportUrl && (
                  <a href={car.techPassportUrl} target="_blank" rel="noreferrer" className="doc-link">
                    📄 Техпаспорт
                  </a>
                )}
                {car.defectsCheckUrl && (
                  <a href={car.defectsCheckUrl} target="_blank" rel="noreferrer" className="doc-link">
                    📋 Акт дефектів
                  </a>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="modal-footer detail-footer">
          <div className="detail-footer-telegram">
            <span className="detail-tg-status">
              Telegram: {car.telegramMessageId
                ? <strong>опубліковано #{car.telegramMessageId}</strong>
                : <strong>не опубліковано</strong>}
            </span>
            <button
              className="filter-reset"
              onClick={handlePublish}
              disabled={tgBusy !== null || cannotPublish}
              title={cannotPublish ? "Спочатку опублікуйте авто, змінивши статус" : ""}
            >
              {tgBusy === "publish"
                ? "..."
                : car.telegramMessageId ? "Перепостити в Telegram" : "Опублікувати в Telegram"}
            </button>
            {car.telegramMessageId && (
              <button
                className="filter-reset"
                onClick={handleDeletePost}
                disabled={tgBusy !== null}
              >
                {tgBusy === "delete" ? "..." : "Видалити пост"}
              </button>
            )}
            {tgError && <span className="detail-tg-error">{tgError}</span>}
          </div>
          <div className="detail-footer-telegram">
            <span className="detail-tg-status">
              AUTO.RIA: {car.autoriaAdId
                ? <strong>опубліковано #{car.autoriaAdId}</strong>
                : <strong>не опубліковано</strong>}
            </span>
            <button
              className="filter-reset"
              onClick={handleRiaPublish}
              disabled={riaBusy !== null || riaDisabled}
              title={riaDisabled ? "Продані/архівні авто не публікуються на AUTO.RIA" : ""}
            >
              {riaBusy === "publish"
                ? "..."
                : car.autoriaAdId ? "Перепублікувати на AUTO.RIA" : "Опублікувати на AUTO.RIA"}
            </button>
            {car.autoriaAdId && (
              <button
                className="filter-reset"
                onClick={handleRiaDelete}
                disabled={riaBusy !== null}
              >
                {riaBusy === "delete" ? "..." : "Видалити оголошення"}
              </button>
            )}
            {riaError && <span className="detail-tg-error">{riaError}</span>}
          </div>
          <div className="detail-footer-actions">
            <button className="filter-reset" onClick={onClose}>Закрити</button>
            <button className="btn-search" onClick={() => { onClose(); onEdit(car); }}>Редагувати</button>
          </div>
        </div>
      </div>
    </div>
  );
}
