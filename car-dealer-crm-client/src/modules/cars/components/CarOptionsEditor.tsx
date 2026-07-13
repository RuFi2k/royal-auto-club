import { useEffect, useMemo, useState } from "react";
import { fetchAutoRiaOptions } from "../services/cars.api";
import type {
  AutoRiaOptionsCatalog,
  BinaryOption,
  SelectableOption,
  SelectedOption,
} from "../types/car.types";

interface Props {
  value: SelectedOption[];
  onChange: (next: SelectedOption[]) => void;
}

export function CarOptionsEditor({ value, onChange }: Props) {
  const [catalog, setCatalog] = useState<AutoRiaOptionsCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAutoRiaOptions()
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Помилка завантаження опцій");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Quick lookups from the current selection.
  const binaryIds = useMemo(
    () => new Set(value.filter((o) => o.valueId === null).map((o) => o.optionId)),
    [value]
  );
  const selectedValueByOption = useMemo(() => {
    const map = new Map<number, number>();
    for (const o of value) if (o.valueId !== null) map.set(o.optionId, o.valueId);
    return map;
  }, [value]);

  function toggleBinary(optionId: number, checked: boolean) {
    if (checked) {
      onChange([...value, { optionId, valueId: null }]);
    } else {
      onChange(value.filter((o) => o.optionId !== optionId));
    }
  }

  function setSelectable(optionId: number, valueId: number | null) {
    const rest = value.filter((o) => o.optionId !== optionId);
    onChange(valueId === null ? rest : [...rest, { optionId, valueId }]);
  }

  if (loading) return <p className="options-hint">Завантаження опцій…</p>;
  if (error) return <p className="options-error">{error}</p>;
  if (!catalog) return null;

  return (
    <div className="options-editor">
      {catalog.groups.map((group) => {
        const binary = catalog.binary.filter((o) => o.group === group);
        const selectable = catalog.selectable.filter((o) => o.group === group);
        if (binary.length === 0 && selectable.length === 0) return null;

        return (
          <div key={group} className="options-group">
            <h4 className="options-group-title">{group}</h4>

            {selectable.length > 0 && (
              <div className="form-grid">
                {selectable.map((opt) => (
                  <SelectableField
                    key={opt.id}
                    option={opt}
                    value={selectedValueByOption.get(opt.id) ?? null}
                    onChange={(v) => setSelectable(opt.id, v)}
                  />
                ))}
              </div>
            )}

            {binary.length > 0 && (
              <div className="options-binary-grid">
                {binary.map((opt) => (
                  <BinaryField
                    key={opt.id}
                    option={opt}
                    checked={binaryIds.has(opt.id)}
                    onToggle={(c) => toggleBinary(opt.id, c)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BinaryField({
  option,
  checked,
  onToggle,
}: {
  option: BinaryOption;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className="options-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      <span>{option.label}</span>
    </label>
  );
}

function SelectableField({
  option,
  value,
  onChange,
}: {
  option: SelectableOption;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="form-field">
      <label>{option.label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">—</option>
        {option.values.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
    </div>
  );
}
