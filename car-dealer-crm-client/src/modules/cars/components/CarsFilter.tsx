import { useMemo, useState } from "react";
import type { CarFilters } from "../types/car.types";

interface Props {
  filters: CarFilters;
  onChange: (filters: CarFilters) => void;
}

const EXTENDED_KEYS: Array<keyof CarFilters> = [
  "bodyType", "engineType", "gearboxType", "drivetrain", "cabinType",
  "customsStatus", "sellType",
  "yearMin", "yearMax",
  "enginePowerMin", "enginePowerMax",
  "engineVolumeMin", "engineVolumeMax",
  "isCryptoAvailable",
];

export function CarsFilter({ filters, onChange }: Props) {
  // One controlled object instead of N pieces of state.
  const [draft, setDraft] = useState<CarFilters>(filters);
  // Auto-open the panel if any extended filter is currently set on mount.
  const [extendedOpen, setExtendedOpen] = useState(
    EXTENDED_KEYS.some((k) => filters[k]),
  );

  const extendedActiveCount = useMemo(
    () => EXTENDED_KEYS.filter((k) => draft[k]).length,
    [draft],
  );

  function set<K extends keyof CarFilters>(key: K, value: CarFilters[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSearch() {
    // Drop empty strings before passing up.
    const out: CarFilters = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v !== undefined && v !== null && v !== "") (out as Record<string, unknown>)[k] = v;
    }
    onChange(out);
  }

  function handleReset() {
    setDraft({});
    onChange({});
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  return (
    <div className="cars-filter">
      <div className="filter-field">
        <label>ID</label>
        <input
          type="number"
          placeholder="напр. 3"
          value={draft.id ?? ""}
          style={{ minWidth: 80, maxWidth: 90 }}
          onChange={(e) => set("id", e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="filter-field">
        <label>Марка</label>
        <input
          type="text"
          placeholder="напр. BMW"
          value={draft.brand ?? ""}
          onChange={(e) => set("brand", e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="filter-field">
        <label>Модель</label>
        <input
          type="text"
          placeholder="напр. X5"
          value={draft.model ?? ""}
          onChange={(e) => set("model", e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="filter-field">
        <label>Пробіг (км)</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            placeholder="Від"
            value={draft.mileageMin ?? ""}
            style={{ minWidth: 80 }}
            onChange={(e) => set("mileageMin", e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span style={{ color: "#a0aec0", fontSize: 13 }}>—</span>
          <input
            type="number"
            placeholder="До"
            value={draft.mileageMax ?? ""}
            style={{ minWidth: 80 }}
            onChange={(e) => set("mileageMax", e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="filter-field">
        <label>Ціна на сайті ($)</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            placeholder="Від"
            value={draft.priceMin ?? ""}
            style={{ minWidth: 90 }}
            onChange={(e) => set("priceMin", e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span style={{ color: "#a0aec0", fontSize: 13 }}>—</span>
          <input
            type="number"
            placeholder="До"
            value={draft.priceMax ?? ""}
            style={{ minWidth: 90 }}
            onChange={(e) => set("priceMax", e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="filter-field">
        <label>Походження</label>
        <select value={draft.carOrigin ?? ""} onChange={(e) => set("carOrigin", e.target.value)}>
          <option value="">Усі</option>
          <option value="EU">ЄС</option>
          <option value="US">США</option>
          <option value="korea">Корея</option>
          <option value="japan">Японія</option>
          <option value="china">Китай</option>
          <option value="other">Інше</option>
        </select>
      </div>

      <div className="filter-field">
        <label>Розташування</label>
        <select value={draft.carLocation ?? ""} onChange={(e) => set("carLocation", e.target.value)}>
          <option value="">Усі</option>
          <option value="dealership">Автосалон</option>
          <option value="owner">Власник</option>
        </select>
      </div>

      <div className="filter-field">
        <label>Наявність</label>
        <select value={draft.isAvailable ?? ""} onChange={(e) => set("isAvailable", e.target.value)}>
          <option value="">Усі</option>
          <option value="true">Наявний</option>
          <option value="false">Недоступний</option>
        </select>
      </div>

      <div className="filter-actions">
        <button className="btn-search" onClick={handleSearch}>Пошук</button>
        <button className="filter-reset" onClick={handleReset}>Скинути</button>
        <button
          type="button"
          className="filter-reset"
          style={{ background: extendedOpen ? "#facc15" : undefined, color: extendedOpen ? "#1a1a2e" : undefined }}
          onClick={() => setExtendedOpen((o) => !o)}
        >
          Розширений {extendedOpen ? "▲" : "▼"}{extendedActiveCount > 0 ? ` (${extendedActiveCount})` : ""}
        </button>
      </div>

      {extendedOpen && (
        <div className="cars-filter-extended">

          <div className="filter-field">
            <label>Кузов</label>
            <select value={draft.bodyType ?? ""} onChange={(e) => set("bodyType", e.target.value)}>
              <option value="">Усі</option>
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

          <div className="filter-field">
            <label>Двигун</label>
            <select value={draft.engineType ?? ""} onChange={(e) => set("engineType", e.target.value)}>
              <option value="">Усі</option>
              <option value="gasoline">Бензин</option>
              <option value="diesel">Дизель</option>
              <option value="electric">Електро</option>
              <option value="hybrid_gasoline">Гібрид (бензин)</option>
              <option value="hybrid_diesel">Гібрид (дизель)</option>
              <option value="gas">Газ</option>
              <option value="gasoline_gas">Бензин + газ</option>
            </select>
          </div>

          <div className="filter-field">
            <label>КПП</label>
            <select value={draft.gearboxType ?? ""} onChange={(e) => set("gearboxType", e.target.value)}>
              <option value="">Усі</option>
              <option value="automatic">Автомат</option>
              <option value="manual">Механіка</option>
              <option value="cvt">Варіатор</option>
              <option value="robot">Робот</option>
              <option value="dual_clutch">Подв. зчеплення</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Привід</label>
            <select value={draft.drivetrain ?? ""} onChange={(e) => set("drivetrain", e.target.value)}>
              <option value="">Усі</option>
              <option value="fwd">Передній</option>
              <option value="rwd">Задній</option>
              <option value="awd">Повний (AWD)</option>
              <option value="four_wd">Повний (4WD)</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Тип продажу</label>
            <select value={draft.sellType ?? ""} onChange={(e) => set("sellType", e.target.value)}>
              <option value="">Усі</option>
              <option value="retail">Роздріб</option>
              <option value="wholesale">Гурт</option>
              <option value="auction">Аукціон</option>
              <option value="consignment">Консигнація</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Розмитнення</label>
            <select value={draft.customsStatus ?? ""} onChange={(e) => set("customsStatus", e.target.value)}>
              <option value="">Усі</option>
              <option value="cleared">Розмитнено</option>
              <option value="not_cleared">Не розмитнено</option>
              <option value="in_progress">В процесі</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Рік</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                placeholder="Від"
                value={draft.yearMin ?? ""}
                style={{ minWidth: 75 }}
                onChange={(e) => set("yearMin", e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <span style={{ color: "#a0aec0", fontSize: 13 }}>—</span>
              <input
                type="number"
                placeholder="До"
                value={draft.yearMax ?? ""}
                style={{ minWidth: 75 }}
                onChange={(e) => set("yearMax", e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          <div className="filter-field">
            <label>Потужність (к.с.)</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                placeholder="Від"
                value={draft.enginePowerMin ?? ""}
                style={{ minWidth: 75 }}
                onChange={(e) => set("enginePowerMin", e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <span style={{ color: "#a0aec0", fontSize: 13 }}>—</span>
              <input
                type="number"
                placeholder="До"
                value={draft.enginePowerMax ?? ""}
                style={{ minWidth: 75 }}
                onChange={(e) => set("enginePowerMax", e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          <div className="filter-field">
            <label>Об'єм (л)</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                step="0.1"
                placeholder="Від"
                value={draft.engineVolumeMin ?? ""}
                style={{ minWidth: 75 }}
                onChange={(e) => set("engineVolumeMin", e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <span style={{ color: "#a0aec0", fontSize: 13 }}>—</span>
              <input
                type="number"
                step="0.1"
                placeholder="До"
                value={draft.engineVolumeMax ?? ""}
                style={{ minWidth: 75 }}
                onChange={(e) => set("engineVolumeMax", e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          <div className="filter-field">
            <label>Криптовалюта</label>
            <select value={draft.isCryptoAvailable ?? ""} onChange={(e) => set("isCryptoAvailable", e.target.value)}>
              <option value="">Усі</option>
              <option value="true">Так</option>
              <option value="false">Ні</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
