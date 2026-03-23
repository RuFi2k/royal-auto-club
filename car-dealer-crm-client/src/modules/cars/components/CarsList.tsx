import type { Car } from "../types/car.types";

interface Props {
  cars: Car[];
  loading: boolean;
  onView: (car: Car) => void;
  onEdit: (car: Car) => void;
  onToggleAvailability: (car: Car) => void;
  onDelete: (car: Car) => void;
  onManageArchives: (car: Car) => void;
}

function fmt(value: number) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}

const ENGINE_TYPE: Record<string, string> = {
  gasoline: "Бензин",
  diesel: "Дизель",
  electric: "Електро",
  hybrid_gasoline: "Гібрид (бензин)",
  hybrid_diesel: "Гібрид (дизель)",
  gas: "Газ",
  gasoline_gas: "Бензин + газ",
};

const BODY_TYPE: Record<string, string> = {
  sedan: "Седан",
  suv: "Позашляховик",
  crossover: "Кросовер",
  hatchback: "Хетчбек",
  coupe: "Купе",
  wagon: "Універсал",
  minivan: "Мінівен",
  pickup: "Пікап",
  van: "Фургон",
  convertible: "Кабріолет",
  liftback: "Ліфтбек",
};

const GEARBOX_TYPE: Record<string, string> = {
  automatic: "Автомат",
  manual: "Механіка",
  cvt: "Варіатор",
  robot: "Робот",
  dual_clutch: "Подв. зчеплення",
};

const DRIVETRAIN: Record<string, string> = {
  fwd: "Передній",
  rwd: "Задній",
  awd: "Повний (AWD)",
  four_wd: "Повний (4WD)",
};

const CAR_LOCATION: Record<string, string> = {
  dealership: "Автосалон",
  owner: "Власник",
};

const CUSTOMS: Record<string, string> = {
  cleared: "Розмитнено",
  not_cleared: "Не розмитнено",
  in_progress: "В процесі",
};

function NoPhotoIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" strokeWidth="1.5">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="8" cy="8" r="1" fill="#cbd5e0" stroke="none" />
      <path d="M7 17l3-4 2 2.5 2-2 3 3.5" />
    </svg>
  );
}

export function CarsList({ cars, loading, onView, onEdit, onToggleAvailability, onDelete, onManageArchives }: Props) {
  if (loading) return <div className="cars-state">Завантаження...</div>;
  if (!cars.length) return <div className="cars-state">Автомобілів не знайдено.</div>;

  return (
    <div className="cars-list">
      {cars.map((car) => (
        <div key={car.id} className="car-row">

          {/* Image */}
          <div className="car-row-image">
            {car.photoUrl
              ? <img src={car.photoUrl} alt={`${car.brand} ${car.model}`} />
              : <div className="car-no-photo"><NoPhotoIcon /><span>Немає фото</span></div>
            }
          </div>

          {/* Content */}
          <div className="car-row-body">

            {/* Line 1 — title + status + actions */}
            <div className="car-row-header">
              <div className="car-row-title">
                <span className="car-brand">{car.brand}</span>
                <span className="car-model">{car.model}</span>
                <span className="car-row-id">#{car.id}</span>
              </div>
              <div className="car-row-actions">
                <span className={`badge ${car.isAvailable ? "badge-available" : "badge-unavailable"}`}>
                  {car.isAvailable ? "Наявний" : "Продано"}
                </span>
                <button className="action-btn action-view" onClick={() => onView(car)}>
                  Деталі
                </button>
                <button className="action-btn action-edit" onClick={() => onEdit(car)}>
                  Редагувати
                </button>
                <button className="action-btn action-archive" onClick={() => onManageArchives(car)}>
                  Архіви фото
                </button>
                {car.isAvailable && (
                  <button className="action-btn action-sold" onClick={() => onToggleAvailability(car)}>
                    Продати
                  </button>
                )}
                <button className="action-btn action-delete" onClick={() => onDelete(car)}>
                  Видалити
                </button>
              </div>
            </div>

            {/* Line 2 — basic */}
            <div className="car-row-line">
              <span className="row-tag">{car.year}</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{car.mileage.toLocaleString("uk-UA")} км</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{car.color}</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{BODY_TYPE[car.bodyType] ?? car.bodyType}</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{car.doorsCount} дв.</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{car.seatsCount} міс.</span>
            </div>

            {/* Line 3 — engine */}
            <div className="car-row-line">
              <span className="row-tag">{ENGINE_TYPE[car.engineType] ?? car.engineType}</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{car.engineVolume}л</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{car.enginePower} к.с.</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{GEARBOX_TYPE[car.gearboxType] ?? car.gearboxType}</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{DRIVETRAIN[car.drivetrain] ?? car.drivetrain}</span>
            </div>

            {/* Line 4 — logistics */}
            <div className="car-row-line">
              <span className={`badge badge-origin`}>{car.carOrigin}</span>
              <span className="row-sep">·</span>
              <span className="row-tag">{CAR_LOCATION[car.carLocation] ?? car.carLocation}</span>
              <span className="row-sep">·</span>
              <span className={`badge badge-customs-${car.customsStatus.replace(/_/g, "-")}`}>
                {CUSTOMS[car.customsStatus] ?? car.customsStatus}
              </span>
              <span className="row-sep">·</span>
              <span className="row-tag row-location">{car.location}</span>
            </div>

            {/* Line 4b — documents */}
            {(car.techPassportUrl || car.defectsCheckUrl) && (
              <div className="car-row-docs">
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
            )}

            {/* Line 5 — prices + responsible */}
            <div className="car-row-footer">
              <div className="car-row-prices">
                <span className="price-main">{fmt(car.websitePrice)}</span>
                <span className="price-sub">Дилер: {fmt(car.dealerPrice)}</span>
                <span className="price-sub">Власник: {fmt(car.ownerPrice)}</span>
                {car.isCryptoAvailable && <span className="badge badge-crypto">Крипто</span>}
                {car.priceChangedAt && (
                  <span className="price-date">Ціна оновлена: {fmtDate(car.priceChangedAt)}</span>
                )}
              </div>
              <span className="car-row-responsible">{car.responsiblePerson}</span>
            </div>

          </div>
        </div>
      ))}
    </div>
  );
}
