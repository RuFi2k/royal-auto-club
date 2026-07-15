// AI-assisted AUTO.RIA option suggestion.
//
// Given a car's make/model/year (and a few known specs), asks Claude which
// AUTO.RIA equipment options that trim most likely has, and returns a validated
// selection in the same shape the CRM stores/publishes. Best-effort: the admin
// reviews and edits the result before saving, so we bias toward the options a
// given trim commonly ships with rather than guessing exhaustively.
import Anthropic from "@anthropic-ai/sdk";
import {
  BINARY_OPTIONS,
  SELECTABLE_OPTIONS,
  GROUP_ORDER,
  normalizeSelectedOptions,
  type SelectedOption,
} from "./options-catalog";

const MODEL = process.env.ANTHROPIC_MODEL_OPTIONS || "claude-sonnet-5";

export interface SuggestCarInput {
  brand: string;
  model: string;
  year: number;
  bodyType?: string | null;
  engineType?: string | null;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export function isSuggestConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Compact catalog the model chooses from — grouped for readability, ids are what
// it must return. Cached at module load; it never changes at runtime.
const CATALOG_TEXT = buildCatalogText();

function buildCatalogText(): string {
  const lines: string[] = [];
  lines.push("BINARY OPTIONS (checkboxes) — return the ids the car has:");
  for (const group of GROUP_ORDER) {
    const items = BINARY_OPTIONS.filter((o) => o.group === group);
    if (items.length === 0) continue;
    lines.push(`  [${group}]`);
    for (const o of items) lines.push(`    ${o.id}: ${o.label}`);
  }
  lines.push("");
  lines.push("SELECTABLE OPTIONS — for each that applies, return {field, valueId}:");
  for (const o of SELECTABLE_OPTIONS) {
    const vals = o.values.map((v) => `${v.id}=${v.label}`).join(", ");
    lines.push(`  ${o.field} (${o.label}): ${vals}`);
  }
  return lines.join("\n");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    binary: {
      type: "array",
      description: "ids of binary (checkbox) options the car most likely has",
      items: { type: "integer" },
    },
    selectable: {
      type: "array",
      description: "selectable options the car has, by field name and chosen value id",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          valueId: { type: "integer" },
        },
        required: ["field", "valueId"],
        additionalProperties: false,
      },
    },
  },
  required: ["binary", "selectable"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a car-specs expert helping a Ukrainian used-car dealer pre-fill AUTO.RIA equipment options.
Given a car (make, model, year, and sometimes body/engine type), decide which options that trim/generation most COMMONLY ships with in the used-car market.
Rules:
- Prefer options typical for a mid/well-equipped version of that model and year; do not invent exotic packages.
- Be conservative: if an option is uncommon or you are unsure, omit it. Missing an option is better than adding a wrong one.
- Only use ids and field names from the provided catalog. Never output ids that are not listed.
- Reply ONLY by matching the required JSON schema. No prose.`;

// field -> selectable optionId, for mapping the model's answer back to storage.
const FIELD_TO_OPTION_ID = new Map(SELECTABLE_OPTIONS.map((o) => [o.field, o.id]));

export async function suggestCarOptions(input: SuggestCarInput): Promise<SelectedOption[]> {
  const ai = anthropic();
  if (!ai) throw Object.assign(new Error("AI не налаштовано (ANTHROPIC_API_KEY)"), { status: 501 });

  const specLines = [
    `Make: ${input.brand}`,
    `Model: ${input.model}`,
    `Year: ${input.year}`,
    input.bodyType ? `Body type: ${input.bodyType}` : null,
    input.engineType ? `Engine type: ${input.engineType}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const message = await ai.messages.create({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${CATALOG_TEXT}\n\n---\nCar:\n${specLines}\n\nReturn the options this car most likely has.`,
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);

  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];

  let parsed: { binary?: unknown; selectable?: unknown };
  try {
    parsed = JSON.parse(text.text);
  } catch {
    return [];
  }

  // Reshape the model's answer into the CarOption selection shape, then validate
  // against the catalog (drops any hallucinated ids / values).
  const raw: Array<{ optionId: number; valueId?: number | null }> = [];
  if (Array.isArray(parsed.binary)) {
    for (const id of parsed.binary) {
      const n = Number(id);
      if (Number.isInteger(n)) raw.push({ optionId: n, valueId: null });
    }
  }
  if (Array.isArray(parsed.selectable)) {
    for (const s of parsed.selectable) {
      if (!s || typeof s !== "object") continue;
      const field = (s as { field?: unknown }).field;
      const valueId = Number((s as { valueId?: unknown }).valueId);
      const optionId = typeof field === "string" ? FIELD_TO_OPTION_ID.get(field) : undefined;
      if (optionId !== undefined && Number.isInteger(valueId)) raw.push({ optionId, valueId });
    }
  }

  return normalizeSelectedOptions(raw);
}
