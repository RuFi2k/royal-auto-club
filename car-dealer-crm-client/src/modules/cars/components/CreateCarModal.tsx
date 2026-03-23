import { useEffect, useRef, useState } from "react";
import { createCar, updateCar } from "../services/cars.api";
import { uploadCarFile } from "../services/storage";
import type { Car } from "../types/car.types";

const DRAFT_KEY = "car-form-draft";

type FormData = Omit<Car, "id" | "createdAt" | "updatedAt" | "priceChangedAt">;

const DEFAULTS: FormData = {
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  mileage: 0,
  color: "",
  vinNumber: "",
  registrationNumber: "",
  countryOfRegistration: "",
  engineType: "gasoline",
  engineVolume: 2.0,
  enginePower: 150,
  gearboxType: "automatic",
  drivetrain: "fwd",
  bodyType: "sedan",
  doorsCount: 4,
  seatsCount: 5,
  cabinType: "standard",
  customsStatus: "cleared",
  carOrigin: "EU",
  carLocation: "dealership",
  location: "",
  sellType: "retail",
  isCryptoAvailable: false,
  ownerPrice: 0,
  websitePrice: 0,
  dealerPrice: 0,
  generalPrice: 0,
  isAvailable: true,
  responsiblePerson: "",
  photoUrl: null,
  techPassportUrl: null,
  defectsCheckUrl: null,
};

interface Props {
  car?: Car;
  onClose: () => void;
  onSaved: (savedCar: Car) => void;
}

function carToForm(car: Car): FormData {
  return {
    brand: car.brand, model: car.model, color: car.color,
    vinNumber: car.vinNumber, registrationNumber: car.registrationNumber,
    countryOfRegistration: car.countryOfRegistration, engineType: car.engineType,
    gearboxType: car.gearboxType, drivetrain: car.drivetrain, bodyType: car.bodyType,
    cabinType: car.cabinType, customsStatus: car.customsStatus, carOrigin: car.carOrigin,
    carLocation: car.carLocation, location: car.location, sellType: car.sellType,
    isCryptoAvailable: car.isCryptoAvailable, isAvailable: car.isAvailable,
    responsiblePerson: car.responsiblePerson,
    photoUrl: car.photoUrl, techPassportUrl: car.techPassportUrl, defectsCheckUrl: car.defectsCheckUrl,
    // Normalize Prisma Decimal / numeric fields to avoid false positives
    year: Number(car.year), mileage: Number(car.mileage),
    engineVolume: Number(car.engineVolume), enginePower: Number(car.enginePower),
    doorsCount: Number(car.doorsCount), seatsCount: Number(car.seatsCount),
    ownerPrice: Number(car.ownerPrice), websitePrice: Number(car.websitePrice),
    dealerPrice: Number(car.dealerPrice), generalPrice: Number(car.generalPrice),
  };
}

function getChangedFields(current: FormData, initial: FormData): Partial<FormData> {
  return (Object.keys(current) as (keyof FormData)[]).reduce((acc, key) => {
    if (current[key] !== initial[key]) acc[key] = current[key] as any;
    return acc;
  }, {} as Partial<FormData>);
}

export function CreateCarModal({ car, onClose, onSaved }: Props) {
  const isCreate = !car;
  const initialForm = useRef<FormData>(car ? carToForm(car) : DEFAULTS);

  function loadInitial(): FormData {
    if (isCreate) {
      try {
        const saved = sessionStorage.getItem(DRAFT_KEY);
        if (saved) return JSON.parse(saved) as FormData;
      } catch { /* ignore */ }
    }
    return initialForm.current;
  }

  const [form, setForm] = useState<FormData>(loadInitial);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [techPassportFile, setTechPassportFile] = useState<File | null>(null);
  const [defectsCheckFile, setDefectsCheckFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist draft to sessionStorage on every change (CREATE mode only)
  useEffect(() => {
    if (isCreate) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }
  }, [form, isCreate]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    const dirty = Object.keys(getChangedFields(form, initialForm.current)).length > 0;
    if (dirty && !window.confirm("Є незбережені зміни. Закрити форму?")) return;
    if (isCreate) sessionStorage.removeItem(DRAFT_KEY);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fileUploads: Partial<FormData> = {};
      if (photoFile) fileUploads.photoUrl = await uploadCarFile(photoFile, "photos");
      if (techPassportFile) fileUploads.techPassportUrl = await uploadCarFile(techPassportFile, "tech-passports");
      if (defectsCheckFile) fileUploads.defectsCheckUrl = await uploadCarFile(defectsCheckFile, "defects-checks");

      const formWithFiles = { ...form, ...fileUploads };

      let saved: Car;
      if (car) {
        const changes = getChangedFields(formWithFiles, initialForm.current);
        if (Object.keys(changes).length === 0) {
          onSaved(car);
          return;
        }
        saved = await updateCar(car.id, changes);
      } else {
        saved = await createCar(formWithFiles);
      }
      if (isCreate) sessionStorage.removeItem(DRAFT_KEY);
      onSaved(saved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{car ? `Редагування — ${car.brand} ${car.model}` : "Нове оголошення"}</h2>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>

          <section className="form-section">
            <h3>Основна інформація</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Марка *</label>
                <input required value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="напр. BMW" />
              </div>
              <div className="form-field">
                <label>Модель *</label>
                <input required value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="напр. X5" />
              </div>
              <div className="form-field">
                <label>Рік *</label>
                <input required type="number" value={form.year} onChange={(e) => set("year", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>Пробіг (км) *</label>
                <input required type="number" min={0} value={form.mileage} onChange={(e) => set("mileage", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>Колір *</label>
                <input required value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="напр. Чорний" />
              </div>
              <div className="form-field">
                <label>VIN-номер *</label>
                <input required value={form.vinNumber} onChange={(e) => set("vinNumber", e.target.value)} placeholder="17 символів VIN" />
              </div>
              <div className="form-field">
                <label>Реєстраційний номер *</label>
                <input required value={form.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Країна реєстрації *</label>
                <input required value={form.countryOfRegistration} onChange={(e) => set("countryOfRegistration", e.target.value)} />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>Двигун і трансмісія</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Тип двигуна</label>
                <select value={form.engineType} onChange={(e) => set("engineType", e.target.value)}>
                  <option value="gasoline">Бензин</option>
                  <option value="diesel">Дизель</option>
                  <option value="electric">Електро</option>
                  <option value="hybrid_gasoline">Гібрид (бензин)</option>
                  <option value="hybrid_diesel">Гібрид (дизель)</option>
                  <option value="gas">Газ</option>
                  <option value="gasoline_gas">Бензин + газ</option>
                </select>
              </div>
              <div className="form-field">
                <label>Об'єм двигуна (л)</label>
                <input type="number" step="0.1" min={0} value={form.engineVolume} onChange={(e) => set("engineVolume", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>Потужність (к.с.)</label>
                <input type="number" min={0} value={form.enginePower} onChange={(e) => set("enginePower", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>КПП</label>
                <select value={form.gearboxType} onChange={(e) => set("gearboxType", e.target.value)}>
                  <option value="automatic">Автомат</option>
                  <option value="manual">Механіка</option>
                  <option value="cvt">Варіатор</option>
                  <option value="robot">Робот</option>
                  <option value="dual_clutch">Подвійне зчеплення</option>
                </select>
              </div>
              <div className="form-field">
                <label>Привід</label>
                <select value={form.drivetrain} onChange={(e) => set("drivetrain", e.target.value)}>
                  <option value="fwd">Передній (FWD)</option>
                  <option value="rwd">Задній (RWD)</option>
                  <option value="awd">Повний (AWD)</option>
                  <option value="four_wd">Повний (4WD)</option>
                </select>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>Кузов і салон</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Тип кузова</label>
                <select value={form.bodyType} onChange={(e) => set("bodyType", e.target.value)}>
                  <option value="sedan">Седан</option>
                  <option value="suv">Позашляховик</option>
                  <option value="crossover">Кросовер</option>
                  <option value="hatchback">Хетчбек</option>
                  <option value="coupe">Купе</option>
                  <option value="wagon">Універсал</option>
                  <option value="minivan">Мінівен</option>
                  <option value="pickup">Пікап</option>
                  <option value="van">Фургон</option>
                  <option value="convertible">Кабріолет</option>
                  <option value="liftback">Ліфтбек</option>
                </select>
              </div>
              <div className="form-field">
                <label>Дверей</label>
                <input type="number" min={1} max={6} value={form.doorsCount} onChange={(e) => set("doorsCount", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>Місць</label>
                <input type="number" min={1} max={12} value={form.seatsCount} onChange={(e) => set("seatsCount", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>Тип кабіни</label>
                <select value={form.cabinType} onChange={(e) => set("cabinType", e.target.value)}>
                  <option value="standard">Стандарт</option>
                  <option value="extended">Подовжена</option>
                  <option value="crew_cab">Подвійна кабіна</option>
                  <option value="panoramic">Панорамна</option>
                </select>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>Статус і логістика</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Статус розмитнення</label>
                <select value={form.customsStatus} onChange={(e) => set("customsStatus", e.target.value)}>
                  <option value="cleared">Розмитнено</option>
                  <option value="not_cleared">Не розмитнено</option>
                  <option value="in_progress">В процесі</option>
                </select>
              </div>
              <div className="form-field">
                <label>Походження авто</label>
                <select value={form.carOrigin} onChange={(e) => set("carOrigin", e.target.value)}>
                  <option value="EU">ЄС</option>
                  <option value="US">США</option>
                  <option value="korea">Корея</option>
                  <option value="japan">Японія</option>
                  <option value="china">Китай</option>
                  <option value="other">Інше</option>
                </select>
              </div>
              <div className="form-field">
                <label>Розташування авто</label>
                <select value={form.carLocation} onChange={(e) => set("carLocation", e.target.value)}>
                  <option value="dealership">Автосалон</option>
                  <option value="owner">Власник</option>
                </select>
              </div>
              <div className="form-field">
                <label>Фізичне місцезнаходження *</label>
                <input required value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Місто / адреса" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>Ціноутворення</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Тип продажу</label>
                <select value={form.sellType} onChange={(e) => set("sellType", e.target.value)}>
                  <option value="retail">Роздріб</option>
                  <option value="wholesale">Гурт</option>
                  <option value="auction">Аукціон</option>
                  <option value="consignment">Консигнація</option>
                </select>
              </div>
              <div className="form-field">
                <label>Ціна власника ($)</label>
                <input type="number" min={0} value={form.ownerPrice} onChange={(e) => set("ownerPrice", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>Ціна на сайті ($)</label>
                <input type="number" min={0} value={form.websitePrice} onChange={(e) => set("websitePrice", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>Ціна для дилерів ($)</label>
                <input type="number" min={0} value={form.dealerPrice} onChange={(e) => set("dealerPrice", +e.target.value)} />
              </div>
              <div className="form-field">
                <label>Загальна ціна ($)</label>
                <input type="number" min={0} value={form.generalPrice} onChange={(e) => set("generalPrice", +e.target.value)} />
              </div>
              <div className="form-field form-field-checkbox">
                <label>
                  <input type="checkbox" checked={form.isCryptoAvailable} onChange={(e) => set("isCryptoAvailable", e.target.checked)} />
                  Оплата криптовалютою
                </label>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>Управління</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Відповідальна особа *</label>
                <input required value={form.responsiblePerson} onChange={(e) => set("responsiblePerson", e.target.value)} placeholder="Email або ім'я" />
              </div>
              <div className="form-field form-field-checkbox">
                <label>
                  <input type="checkbox" checked={form.isAvailable} onChange={(e) => set("isAvailable", e.target.checked)} />
                  Доступний для купівлі
                </label>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>Фото та документи</h3>
            <div className="form-grid">

              <div className="form-field">
                <label>Фото автомобіля</label>
                {form.photoUrl && !photoFile && (
                  <img src={form.photoUrl} alt="Фото" className="upload-preview" />
                )}
                {photoFile && <span className="upload-filename">📷 {photoFile.name}</span>}
                <input type="file" accept="image/*" className="upload-input"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
              </div>

              <div className="form-field">
                <label>Техпаспорт</label>
                {form.techPassportUrl && !techPassportFile && (
                  <>
                    <img src={form.techPassportUrl} alt="Техпаспорт" className="upload-preview"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    <a href={form.techPassportUrl} target="_blank" rel="noreferrer" className="upload-link">
                      📄 Відкрити документ
                    </a>
                  </>
                )}
                {techPassportFile && <span className="upload-filename">📄 {techPassportFile.name}</span>}
                <input type="file" accept="image/*,application/pdf" className="upload-input"
                  onChange={(e) => setTechPassportFile(e.target.files?.[0] ?? null)} />
              </div>

              <div className="form-field">
                <label>Акт перевірки дефектів</label>
                {form.defectsCheckUrl && !defectsCheckFile && (
                  <>
                    <img src={form.defectsCheckUrl} alt="Акт дефектів" className="upload-preview"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    <a href={form.defectsCheckUrl} target="_blank" rel="noreferrer" className="upload-link">
                      📄 Відкрити документ
                    </a>
                  </>
                )}
                {defectsCheckFile && <span className="upload-filename">📄 {defectsCheckFile.name}</span>}
                <input type="file" accept="image/*,application/pdf" className="upload-input"
                  onChange={(e) => setDefectsCheckFile(e.target.files?.[0] ?? null)} />
              </div>

            </div>
          </section>

          {error && <div className="cars-error" style={{ margin: "0 0 12px" }}>{error}</div>}

          <div className="modal-footer">
            <button type="button" className="filter-reset" onClick={handleClose}>Скасувати</button>
            <button type="submit" className="btn-search" disabled={submitting}>
              {submitting ? "Збереження…" : car ? "Зберегти" : "Додати оголошення"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
