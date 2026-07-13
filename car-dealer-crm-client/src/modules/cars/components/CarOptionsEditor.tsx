import { useEffect, useMemo, useState } from "react";
import { fetchAutoRiaOptions, suggestAutoRiaOptions } from "../services/cars.api";
import type {
  AutoRiaOptionsCatalog,
  BinaryOption,
  SelectableOption,
  SelectedOption,
} from "../types/car.types";

interface CarInfo {
  brand?: string;
  model?: string;
  year?: number;
  bodyType?: string | null;
  engineType?: string | null;
}

interface Props {
  value: SelectedOption[];
  onChange: (next: SelectedOption[]) => void;
  carInfo?: CarInfo;
}

export function CarOptionsEditor({ value, onChange, carInfo }: Props) {
  const [catalog, setCatalog] = useState<AutoRiaOptionsCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

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

  const canSuggest = Boolean(carInfo?.brand && carInfo?.model && carInfo?.year);

  async function handleSuggest() {
    if (!canSuggest || !carInfo) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const suggested = await suggestAutoRiaOptions({
        brand: carInfo.brand as string,
        model: carInfo.model as string,
        year: carInfo.year as number,
        bodyType: carInfo.bodyType,
        engineType: carInfo.engineType,
      });
      // Union by optionId: suggested entries replace existing ones with the
      // same optionId, keep the user's manual selections the AI didn't mention.
      const suggestedIds = new Set(suggested.map((o) => o.optionId));
      const merged = [...value.filter((o) => !suggestedIds.has(o.optionId)), ...suggested];
      onChange(merged);
    } catch (err: unknown) {
      setSuggestError(err instanceof Error ? err.message : "Не вдалося отримати підказку");
    } finally {
      setSuggesting(false);
    }
  }

  if (loading) return <p className="options-hint">Завантаження опцій…</p>;
  if (error) return <p className="options-error">{error}</p>;
  if (!catalog) return null;

  // Groups (in catalog order) that actually have at least one option.
  const groupData = catalog.groups
    .map((group) => ({
      group,
      binary: catalog.binary.filter((o) => o.group === group),
      selectable: catalog.selectable.filter((o) => o.group === group),
    }))
    .filter((g) => g.binary.length > 0 || g.selectable.length > 0);

  const currentGroup =
    (activeGroup && groupData.some((g) => g.group === activeGroup) ? activeGroup : null) ??
    groupData[0]?.group ??
    null;

  const active = groupData.find((g) => g.group === currentGroup);

  return (
    <div className="options-editor">
      {catalog.aiEnabled && (
        <div className="options-ai">
          <button
            type="button"
            className="options-ai-btn"
            onClick={handleSuggest}
            disabled={!canSuggest || suggesting}
            title={
              canSuggest
                ? "Підібрати опції за маркою, моделлю та роком"
                : "Спочатку вкажіть марку, модель і рік"
            }
          >
            {suggesting ? "Аналізую…" : "✨ Заповнити з AI"}
          </button>
          <span className="options-ai-hint">На основі марки, моделі та року</span>
          {suggestError && <span className="options-ai-error">{suggestError}</span>}
        </div>
      )}

      {groupData.length > 0 && (
        <div className="options-tabs" role="tablist">
          {groupData.map(({ group, binary, selectable }) => {
            const count =
              binary.filter((o) => binaryIds.has(o.id)).length +
              selectable.filter((o) => selectedValueByOption.has(o.id)).length;
            return (
              <button
                key={group}
                type="button"
                role="tab"
                aria-selected={group === currentGroup}
                className={`options-tab${group === currentGroup ? " options-tab-active" : ""}`}
                onClick={() => setActiveGroup(group)}
              >
                {group}
                {count > 0 && <span className="options-tab-badge">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div className="options-group">
          {active.selectable.length > 0 && (
            <div className="form-grid">
              {active.selectable.map((opt) => (
                <SelectableField
                  key={opt.id}
                  option={opt}
                  value={selectedValueByOption.get(opt.id) ?? null}
                  onChange={(v) => setSelectable(opt.id, v)}
                />
              ))}
            </div>
          )}

          {active.binary.length > 0 && (
            <div className="options-binary-grid">
              {active.binary.map((opt) => (
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
      )}
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
