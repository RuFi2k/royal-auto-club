import { useState } from "react";
import type { CarFilters } from "../types/car.types";

interface Props {
  filters: CarFilters;
  onChange: (filters: CarFilters) => void;
}

export function CarsFilter({ filters, onChange }: Props) {
  const [id, setId] = useState(filters.id ?? "");
  const [brand, setBrand] = useState(filters.brand ?? "");
  const [model, setModel] = useState(filters.model ?? "");
  const [mileageMin, setMileageMin] = useState(filters.mileageMin ?? "");
  const [mileageMax, setMileageMax] = useState(filters.mileageMax ?? "");
  const [priceMin, setPriceMin] = useState(filters.priceMin ?? "");
  const [priceMax, setPriceMax] = useState(filters.priceMax ?? "");
  const [carOrigin, setCarOrigin] = useState(filters.carOrigin ?? "");
  const [carLocation, setCarLocation] = useState(filters.carLocation ?? "");
  const [isAvailable, setIsAvailable] = useState(filters.isAvailable ?? "");

  function handleSearch() {
    onChange({
      id: id || undefined,
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      mileageMin: mileageMin || undefined,
      mileageMax: mileageMax || undefined,
      priceMin: priceMin || undefined,
      priceMax: priceMax || undefined,
      carOrigin: carOrigin || undefined,
      carLocation: carLocation || undefined,
      isAvailable: isAvailable || undefined,
    });
  }

  function handleReset() {
    setId(""); setBrand(""); setModel("");
    setMileageMin(""); setMileageMax("");
    setPriceMin(""); setPriceMax("");
    setCarOrigin(""); setCarLocation(""); setIsAvailable("");
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
          value={id}
          style={{ minWidth: 80, maxWidth: 90 }}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="filter-field">
        <label>Марка</label>
        <input
          type="text"
          placeholder="напр. BMW"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="filter-field">
        <label>Модель</label>
        <input
          type="text"
          placeholder="напр. X5"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="filter-field">
        <label>Пробіг (км)</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            placeholder="Від"
            value={mileageMin}
            style={{ minWidth: 80 }}
            onChange={(e) => setMileageMin(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span style={{ color: "#a0aec0", fontSize: 13 }}>—</span>
          <input
            type="number"
            placeholder="До"
            value={mileageMax}
            style={{ minWidth: 80 }}
            onChange={(e) => setMileageMax(e.target.value)}
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
            value={priceMin}
            style={{ minWidth: 90 }}
            onChange={(e) => setPriceMin(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span style={{ color: "#a0aec0", fontSize: 13 }}>—</span>
          <input
            type="number"
            placeholder="До"
            value={priceMax}
            style={{ minWidth: 90 }}
            onChange={(e) => setPriceMax(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="filter-field">
        <label>Походження</label>
        <select value={carOrigin} onChange={(e) => setCarOrigin(e.target.value)}>
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
        <select value={carLocation} onChange={(e) => setCarLocation(e.target.value)}>
          <option value="">Усі</option>
          <option value="dealership">Автосалон</option>
          <option value="owner">Власник</option>
        </select>
      </div>

      <div className="filter-field">
        <label>Наявність</label>
        <select value={isAvailable} onChange={(e) => setIsAvailable(e.target.value)}>
          <option value="">Усі</option>
          <option value="true">Наявний</option>
          <option value="false">Недоступний</option>
        </select>
      </div>

      <div className="filter-actions">
        <button className="btn-search" onClick={handleSearch}>Пошук</button>
        <button className="filter-reset" onClick={handleReset}>Скинути</button>
      </div>
    </div>
  );
}
