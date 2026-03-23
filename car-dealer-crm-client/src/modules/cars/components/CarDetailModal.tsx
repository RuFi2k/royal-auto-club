import type { Car } from "../types/car.types";

interface Props {
  car: Car;
  onClose: () => void;
  onEdit: (car: Car) => void;
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
const CABIN_TYPE: Record<string, string> = {
  standard: "Стандарт", extended: "Подовжена", crew_cab: "Подвійна кабіна", panoramic: "Панорамна",
};
const CUSTOMS: Record<string, string> = {
  cleared: "Розмитнено", not_cleared: "Не розмитнено", in_progress: "В процесі",
};
const CAR_ORIGIN: Record<string, string> = {
  EU: "ЄС", US: "США", korea: "Корея", japan: "Японія", china: "Китай", other: "Інше",
};
const CAR_LOCATION: Record<string, string> = {
  dealership: "Автосалон", owner: "Власник",
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

export function CarDetailModal({ car, onClose, onEdit }: Props) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-detail">
        <div className="modal-header">
          <div className="detail-header-title">
            <span className="car-brand">{car.brand}</span>
            <span className="car-model">{car.model}</span>
            <span className="car-row-id">#{car.id}</span>
            <span className={`badge ${car.isAvailable ? "badge-available" : "badge-unavailable"}`}>
              {car.isAvailable ? "Наявний" : "Продано"}
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
              <Field label="Пробіг" value={`${car.mileage.toLocaleString("uk-UA")} км`} />
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
              <Field label="Тип кабіни" value={CABIN_TYPE[car.cabinType] ?? car.cabinType} />
            </div>
          </div>

          <div className="detail-section">
            <h3 className="detail-section-title">Статус і логістика</h3>
            <div className="detail-grid">
              <Field label="Розмитнення" value={CUSTOMS[car.customsStatus] ?? car.customsStatus} />
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
              <Field label="Ціна на сайті" value={fmt(car.websitePrice)} />
              <Field label="Ціна для дилерів" value={fmt(car.dealerPrice)} />
              <Field label="Загальна ціна" value={fmt(car.generalPrice)} />
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

        <div className="modal-footer">
          <button className="filter-reset" onClick={onClose}>Закрити</button>
          <button className="btn-search" onClick={() => { onClose(); onEdit(car); }}>Редагувати</button>
        </div>
      </div>
    </div>
  );
}
