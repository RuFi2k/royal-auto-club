import { useEffect, useRef, useState } from "react";
import { createCar, updateCar } from "../services/cars.api";
import { uploadCarFile } from "../services/storage";
import { uploadOptimizedPhotos } from "../services/photos.api";
import type { Car, SelectedOption } from "../types/car.types";
import { CRASH_BODY_PARTS, CRASH_BODY_PART_LABELS } from "../lib/crash-body-parts";
import { PhotoGalleryModal } from "./PhotoGalleryModal";
import { RichTextEditor } from "./RichTextEditor";
import { CarOptionsEditor } from "./CarOptionsEditor";

type StagedPhoto = {
  key: string;       // local stable id
  file: File;
  previewUrl: string;
  alt: string;
};

const DRAFT_KEY = "car-form-draft-v2";

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
  carOrigin: "EU",
  carLocation: "dealership",
  location: "",
  sellType: "retail",
  isCryptoAvailable: false,
  ownerPrice: 0,
  dealerPrice: 0,
  isAvailable: false,
  responsiblePerson: "",
  listingStatus: "draft",
  eta: null,
  transitStage: null,
  estimatedPrice: null,
  shortDescription: null,
  description: null,
  photoUrl: null,
  techPassportUrl: null,
  defectsCheckUrl: null,
  accidentFree: false,
  crashed: false,
  airbagReplaced: false,
  crashDetails: null,
  crashBodyParts: [],
  options: [],
};


interface Props {
  car?: Car;
  onClose: () => void;
  onSaved: (savedCar: Car) => void;
}

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  decimal?: boolean;
  allowEmpty?: boolean;
}

function NumericInput({ value, onValueChange, decimal = false, allowEmpty = false, min, max, ...props }: NumericInputProps) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    const valid = decimal ? /^\d*(?:[.,]\d*)?$/.test(next) : /^\d*$/.test(next);
    if (!valid) return;
    setText(next);
    if (next === "") {
      onValueChange(allowEmpty ? null : 0);
      return;
    }
    const parsed = Number(next.replace(",", "."));
    if (Number.isFinite(parsed)) onValueChange(parsed);
  }

  function handleBlur() {
    focused.current = false;
    if (text === "") return;
    let parsed = Number(text.replace(",", "."));
    if (min !== undefined) parsed = Math.max(parsed, Number(min));
    if (max !== undefined) parsed = Math.min(parsed, Number(max));
    onValueChange(parsed);
    setText(String(parsed));
  }

  return (
    <input
      {...props}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      onFocus={() => { focused.current = true; }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

function carToForm(car: Car): FormData {
  return {
    brand: car.brand, model: car.model, color: car.color,
    vinNumber: car.vinNumber, registrationNumber: car.registrationNumber,
    countryOfRegistration: car.countryOfRegistration, engineType: car.engineType,
    gearboxType: car.gearboxType, drivetrain: car.drivetrain, bodyType: car.bodyType,
    carOrigin: car.carOrigin,
    carLocation: car.carLocation, location: car.location, sellType: car.sellType,
    isCryptoAvailable: car.isCryptoAvailable, isAvailable: car.isAvailable,
    responsiblePerson: car.responsiblePerson,
    listingStatus: car.listingStatus, eta: car.eta, transitStage: car.transitStage,
    estimatedPrice: car.estimatedPrice,
    shortDescription: car.shortDescription, description: car.description,
    photoUrl: car.photoUrl, techPassportUrl: car.techPassportUrl, defectsCheckUrl: car.defectsCheckUrl,
    accidentFree: car.accidentFree, crashed: car.crashed, airbagReplaced: car.airbagReplaced,
    crashDetails: car.crashDetails, crashBodyParts: [...(car.crashBodyParts ?? [])],
    options: (car.options ?? []).map((o) => ({ optionId: o.optionId, valueId: o.valueId })),
    // Normalize Prisma Decimal / numeric fields to avoid false positives
    year: Number(car.year), mileage: Number(car.mileage),
    engineVolume: Number(car.engineVolume), enginePower: Number(car.enginePower),
    doorsCount: Number(car.doorsCount), seatsCount: Number(car.seatsCount),
    ownerPrice: Number(car.ownerPrice), dealerPrice: Number(car.dealerPrice),
  };
}

function optionsKey(options: SelectedOption[] = []): string {
  return options
    .map((o) => `${o.optionId}:${o.valueId ?? "null"}`)
    .sort()
    .join("|");
}

function optionsChanged(current: SelectedOption[] = [], initial: SelectedOption[] = []): boolean {
  return optionsKey(current) !== optionsKey(initial);
}

function getChangedFields(current: FormData, initial: FormData): Partial<FormData> {
  return (Object.keys(current) as (keyof FormData)[]).reduce((acc, key) => {
    const a = current[key];
    const b = initial[key];
    const changed = Array.isArray(a) || Array.isArray(b)
      ? JSON.stringify(a ?? []) !== JSON.stringify(b ?? [])
      : a !== b;
    if (changed) acc[key] = current[key] as any;
    return acc;
  }, {} as Partial<FormData>);
}

export function CreateCarModal({ car, onClose, onSaved }: Props) {
  const isCreate = !car;
  const canSaveDraft = !car || car.listingStatus === "draft";
  const initialForm = useRef<FormData>(car ? carToForm(car) : DEFAULTS);
  const submitMode = useRef<"draft" | "publish" | "save">(canSaveDraft ? "publish" : "save");

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
  const [techPassportFile, setTechPassportFile] = useState<File | null>(null);
  const [defectsCheckFile, setDefectsCheckFile] = useState<File | null>(null);
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URLs when staged photos are removed/unmounted
  useEffect(() => () => {
    stagedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (techPassportFile) fileUploads.techPassportUrl = await uploadCarFile(techPassportFile, "tech-passports");
      if (defectsCheckFile) fileUploads.defectsCheckUrl = await uploadCarFile(defectsCheckFile, "defects-checks");

      const targetStatus = submitMode.current === "draft"
        ? "draft"
        : submitMode.current === "publish" && form.listingStatus === "draft"
          ? "available"
          : form.listingStatus;
      const formWithFiles: FormData = {
        ...form,
        ...fileUploads,
        listingStatus: targetStatus,
        isAvailable: targetStatus === "available",
      };

      let saved: Car;
      if (car) {
        const changes = getChangedFields(formWithFiles, initialForm.current);
        // Options are compared by set (order-independent), not the generic diff.
        delete changes.options;
        if (optionsChanged(formWithFiles.options, initialForm.current.options)) {
          changes.options = formWithFiles.options ?? [];
        }
        if (Object.keys(changes).length === 0) {
          onSaved(car);
          return;
        }
        saved = await updateCar(car.id, changes);
      } else {
        // CREATE mode — upload staged gallery photos via the optimizing endpoint, then POST with photos[]
        const uploaded = await uploadOptimizedPhotos(stagedPhotos.map((p) => p.file));
        const uploadedPhotos = uploaded.map((item, i) => ({
          url: item.url,
          alt: stagedPhotos[i]?.alt || null,
        }));
        const payload: any = { ...formWithFiles };
        if (uploadedPhotos.length > 0) payload.photos = uploadedPhotos;
        saved = await createCar(payload);
      }
      if (isCreate) sessionStorage.removeItem(DRAFT_KEY);
      onSaved(saved);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function addStagedPhotos(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const additions: StagedPhoto[] = arr.map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      alt: "",
    }));
    setStagedPhotos((prev) => [...prev, ...additions]);
  }

  function removeStagedPhoto(key: string) {
    setStagedPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  }

  function moveStagedPhoto(key: string, delta: number) {
    setStagedPhotos((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function setStagedAlt(key: string, alt: string) {
    setStagedPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, alt } : p)));
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-header-title">
            <h2>{car ? `Редагування — ${car.brand} ${car.model}` : "Нове оголошення"}</h2>
            <span className="save-state">
              {!car || car.listingStatus === "draft"
                ? form.listingStatus === "draft"
                  ? "Чернетка · не опубліковано"
                  : "Буде опубліковано після збереження"
                : "Опубліковано · ручне збереження"}
            </span>
          </div>
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
                <NumericInput required value={form.year} onValueChange={(value) => set("year", value ?? 0)} />
              </div>
              <div className="form-field">
                <label>Пробіг (тис. км) *</label>
                <NumericInput required min={0} value={form.mileage} onValueChange={(value) => set("mileage", value ?? 0)} />
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
                <NumericInput decimal min={0} value={form.engineVolume} onValueChange={(value) => set("engineVolume", value ?? 0)} />
              </div>
              <div className="form-field">
                <label>Потужність (к.с.)</label>
                <NumericInput min={0} value={form.enginePower} onValueChange={(value) => set("enginePower", value ?? 0)} />
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
                <NumericInput min={1} max={6} value={form.doorsCount} onValueChange={(value) => set("doorsCount", value ?? 1)} />
              </div>
              <div className="form-field">
                <label>Місць</label>
                <NumericInput min={1} max={12} value={form.seatsCount} onValueChange={(value) => set("seatsCount", value ?? 1)} />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>Статус і логістика</h3>
            <div className="form-grid">
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
                  <option value="dealership">Площадка</option>
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
                <NumericInput min={0} value={form.ownerPrice} onValueChange={(value) => set("ownerPrice", value ?? 0)} />
              </div>
              <div className="form-field">
                <label>Ціна для дилерів ($)</label>
                <NumericInput min={0} value={form.dealerPrice} onValueChange={(value) => set("dealerPrice", value ?? 0)} />
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
            </div>
          </section>

          <section className="form-section form-section-wide">
            <h3>Опис</h3>
            <div className="form-field">
              <label>Короткий опис (один рядок)</label>
              <input
                type="text"
                value={form.shortDescription ?? ""}
                onChange={(e) => set("shortDescription", e.target.value || null)}
                placeholder="Видно на картках та у соц-мережах"
                maxLength={240}
              />
            </div>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Повний опис</label>
              <RichTextEditor
                value={form.description}
                onChange={(html) => set("description", html)}
                placeholder="Розкажіть історію автомобіля: комплектація, обслуговування, особливі деталі…"
              />
            </div>
          </section>

          <section className="form-section">
            <h3>Статус оголошення</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Статус *</label>
                <select
                  value={form.listingStatus}
                  onChange={(e) => {
                    const next = e.target.value as FormData["listingStatus"];
                    setForm((prev) => ({
                      ...prev,
                      listingStatus: next,
                      // Mirror the legacy isAvailable boolean and clear
                      // upcoming-only fields when leaving that state.
                      isAvailable: next === "available",
                      ...(next !== "upcoming" ? { transitStage: null } : {}),
                    }));
                  }}
                >
                  {(!car || car.listingStatus === "draft") && (
                    <option value="draft">Чернетка (не опубліковано)</option>
                  )}
                  <option value="upcoming">Очікується (в дорозі)</option>
                  <option value="available">У наявності</option>
                  <option value="sold">Продано</option>
                  <option value="archived">Архів (приховано)</option>
                </select>
              </div>
              {form.listingStatus === "upcoming" && (
                <>
                  <div className="form-field">
                    <label>Очікувана дата прибуття</label>
                    <input
                      type="date"
                      value={form.eta ? form.eta.slice(0, 10) : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        set("eta", v ? new Date(v).toISOString() : null);
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label>Етап логістики</label>
                    <select
                      value={form.transitStage ?? ""}
                      onChange={(e) => set("transitStage", (e.target.value || null) as FormData["transitStage"])}
                    >
                      <option value="">—</option>
                      <option value="ordered">Замовлено</option>
                      <option value="in_transit">В дорозі</option>
                      <option value="at_port">У порту</option>
                      <option value="customs">Розмитнення</option>
                      <option value="ready">Готове</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Орієнтовна ціна ($)</label>
                    <NumericInput
                      allowEmpty
                      placeholder="напр. 71500"
                      value={form.estimatedPrice}
                      onValueChange={(value) => set("estimatedPrice", value)}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="form-section form-section-wide">
            <h3>Історія ремонту</h3>
            <div className="form-grid">
              <div className="form-field form-field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={form.accidentFree}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setForm((prev) => ({
                        ...prev,
                        accidentFree: val,
                        // If marked accident-free, ensure crashed/airbag/parts are cleared.
                        ...(val ? { crashed: false, airbagReplaced: false, crashBodyParts: [], crashDetails: null } : {}),
                      }));
                    }}
                  />
                  Без ДТП (підтверджено)
                </label>
              </div>
              <div className="form-field form-field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={form.crashed}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setForm((prev) => ({
                        ...prev,
                        crashed: val,
                        // Toggling on cancels the accident-free claim.
                        ...(val ? { accidentFree: false } : { airbagReplaced: false, crashBodyParts: [], crashDetails: null }),
                      }));
                    }}
                  />
                  Був у ДТП / є ремонти
                </label>
              </div>
            </div>

            {form.crashed && (
              <>
                <div className="form-field" style={{ marginTop: 12 }}>
                  <label>Пошкоджені зони</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CRASH_BODY_PARTS.map((part) => {
                      const active = form.crashBodyParts.includes(part);
                      return (
                        <button
                          key={part}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              crashBodyParts: active
                                ? prev.crashBodyParts.filter((p) => p !== part)
                                : [...prev.crashBodyParts, part],
                            }))
                          }
                          style={{
                            background: active ? "#facc15" : "#15151f",
                            color: active ? "#1a1a2e" : "#cbd5e1",
                            border: `1px solid ${active ? "#facc15" : "#2a2a3a"}`,
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {CRASH_BODY_PART_LABELS[part]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: 12 }}>
                  <div className="form-field form-field-checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.airbagReplaced}
                        onChange={(e) => set("airbagReplaced", e.target.checked)}
                      />
                      Подушки безпеки замінювали
                    </label>
                  </div>
                </div>

                <div className="form-field" style={{ marginTop: 12 }}>
                  <label>Деталі ремонту</label>
                  <textarea
                    rows={3}
                    value={form.crashDetails ?? ""}
                    onChange={(e) => set("crashDetails", e.target.value || null)}
                    placeholder="Що саме ремонтували, коли, де"
                    style={{
                      width: "100%",
                      background: "#0e0e16",
                      border: "1px solid #2a2a3a",
                      borderRadius: 6,
                      color: "#fff",
                      padding: "8px 10px",
                      fontSize: 13,
                      resize: "vertical",
                    }}
                  />
                </div>
              </>
            )}
          </section>

          <section className="form-section form-section-wide">
            <h3>Опції (AUTO.RIA)</h3>
            <CarOptionsEditor
              value={form.options ?? []}
              onChange={(next) => set("options", next)}
              carInfo={{
                brand: form.brand,
                model: form.model,
                year: form.year,
                bodyType: form.bodyType,
                engineType: form.engineType,
              }}
            />
          </section>

          <section className="form-section form-section-wide">
            <h3>Галерея</h3>
            {isCreate ? (
              <>
                <div className="form-field">
                  <label>Фото автомобіля (перше — обкладинка)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="upload-input"
                    onChange={(e) => {
                      addStagedPhotos(e.target.files ?? []);
                      e.target.value = "";
                    }}
                  />
                </div>
                {stagedPhotos.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    {stagedPhotos.map((p, idx) => (
                      <div
                        key={p.key}
                        style={{
                          border: "1px solid #2a2a3a",
                          borderRadius: 10,
                          overflow: "hidden",
                          background: "#15151f",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div style={{ position: "relative", aspectRatio: "16/10", background: "#000" }}>
                          <img
                            src={p.previewUrl}
                            alt={p.alt}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          {idx === 0 && (
                            <span
                              style={{
                                position: "absolute",
                                top: 6,
                                left: 6,
                                background: "#facc15",
                                color: "#1a1a2e",
                                padding: "2px 6px",
                                borderRadius: 999,
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              ОБКЛАДИНКА
                            </span>
                          )}
                          <span
                            style={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              background: "rgba(0,0,0,0.6)",
                              color: "#fff",
                              padding: "1px 5px",
                              borderRadius: 6,
                              fontSize: 10,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            #{idx + 1}
                          </span>
                        </div>
                        <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          <input
                            type="text"
                            placeholder="Опис"
                            value={p.alt}
                            onChange={(e) => setStagedAlt(p.key, e.target.value)}
                            style={{
                              width: "100%",
                              background: "#0e0e16",
                              border: "1px solid #2a2a3a",
                              borderRadius: 6,
                              color: "#fff",
                              padding: "4px 6px",
                              fontSize: 11,
                            }}
                          />
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              type="button"
                              className="action-btn action-edit"
                              onClick={() => moveStagedPhoto(p.key, -1)}
                              disabled={idx === 0}
                              title="Підняти вгору"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="action-btn action-edit"
                              onClick={() => moveStagedPhoto(p.key, 1)}
                              disabled={idx === stagedPhotos.length - 1}
                              title="Опустити вниз"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="action-btn action-sold"
                              onClick={() => removeStagedPhoto(p.key)}
                              style={{ marginLeft: "auto" }}
                            >
                              Видалити
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="form-field">
                <label>Фото галереї</label>
                <button
                  type="button"
                  className="action-btn action-edit"
                  onClick={() => setShowGalleryModal(true)}
                  style={{ alignSelf: "flex-start" }}
                >
                  Відкрити редактор галереї →
                </button>
                <p style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                  Управляйте обкладинкою, додавайте та видаляйте фото в окремому редакторі.
                </p>
              </div>
            )}
          </section>

          <section className="form-section">
            <h3>Документи</h3>
            <div className="form-grid">

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
            {canSaveDraft && (
              <button
                type="submit"
                className="filter-reset"
                disabled={submitting}
                onClick={() => { submitMode.current = "draft"; }}
              >
                {submitting && submitMode.current === "draft" ? "Збереження…" : "Зберегти чернетку"}
              </button>
            )}
            <button
              type="submit"
              className="btn-search"
              disabled={submitting}
              onClick={() => { submitMode.current = canSaveDraft ? "publish" : "save"; }}
            >
              {submitting && submitMode.current !== "draft"
                ? "Збереження…"
                : canSaveDraft ? "Опублікувати" : "Зберегти"}
            </button>
          </div>

        </form>

        {showGalleryModal && car && (
          <PhotoGalleryModal car={car} onClose={() => setShowGalleryModal(false)} />
        )}
      </div>
    </div>
  );
}
