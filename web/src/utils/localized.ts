type LanguageKey = "en" | "mm" | string;

export type LocalizedTextPair = {
  en: string | null;
  mm: string | null;
};

const EN_KEYS = ["en", "english", "english_name", "name_en"] as const;
const MM_KEYS = ["mm", "my", "burmese", "burmese_name", "name_mm"] as const;

type Dictionary = Record<string, unknown>;

declare const JSON: typeof globalThis.JSON;

function isRecord(value: unknown): value is Dictionary {
  return typeof value === "object" && value !== null;
}

function parsePossibleObject(value: unknown): Dictionary | null {
  if (!value) return null;
  if (isRecord(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toCleanString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function pickFromKeys(keys: readonly string[], source: Dictionary): string | null {
  for (const key of keys) {
    if (!(key in source)) continue;
    const candidate = source[key];
    const value = toCleanString(candidate);
    if (value) return value;
  }
  return null;
}

function firstLocalizedValue(values: unknown[], language: "en" | "mm"): string | null {
  for (const value of values) {
    if (value == null) continue;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      const cleaned = toCleanString(value);
      if (cleaned) return cleaned;
      continue;
    }

    const parsed = parsePossibleObject(value);
    if (!parsed) continue;
    const fromParsed = pickFromKeys(language === "en" ? EN_KEYS : MM_KEYS, parsed);
    if (fromParsed) return fromParsed;
  }
  return null;
}

export function normalizeLocalizedNames(input: {
  name?: unknown;
  english_name?: unknown;
  burmese_name?: unknown;
  en?: unknown;
  mm?: unknown;
  name_en?: unknown;
  name_mm?: unknown;
}): LocalizedTextPair {
  const parsedName = parsePossibleObject(input.name);

  const en = firstLocalizedValue(
    [
      parsedName ? pickFromKeys(EN_KEYS, parsedName) : null,
      input.english_name,
      input.en,
      input.name_en,
    ],
    "en"
  );

  const mm = firstLocalizedValue(
    [
      parsedName ? pickFromKeys(MM_KEYS, parsedName) : null,
      input.burmese_name,
      input.mm,
      input.name_mm,
    ],
    "mm"
  );

  return {
    en: en ?? null,
    mm: mm ?? null,
  };
}

type LocalizedFieldInput = {
  value?: unknown;
  en?: unknown;
  mm?: unknown;
  value_en?: unknown;
  value_mm?: unknown;
  english?: unknown;
  burmese?: unknown;
  english_value?: unknown;
  burmese_value?: unknown;
  json?: unknown;
  value_json?: unknown;
  english_json?: unknown;
  burmese_json?: unknown;
};

function normalizeLocalizedFieldInternal(input: LocalizedFieldInput): LocalizedTextPair {
  const parsedObjects: Array<Record<string, unknown> | null> = [
    parsePossibleObject(input.json),
    parsePossibleObject(input.value_json),
    parsePossibleObject(input.value),
    parsePossibleObject(input.english_json),
    parsePossibleObject(input.burmese_json),
  ];

  const en = firstLocalizedValue(
    [
      ...parsedObjects.map((obj) => (obj ? pickFromKeys(EN_KEYS, obj) : null)),
      input.en,
      input.value_en,
      input.english,
      input.english_value,
      input.value,
    ],
    "en"
  );

  const mm = firstLocalizedValue(
    [
      ...parsedObjects.map((obj) => (obj ? pickFromKeys(MM_KEYS, obj) : null)),
      input.mm,
      input.value_mm,
      input.burmese,
      input.burmese_value,
      input.value,
    ],
    "mm"
  );

  return {
    en: en ?? null,
    mm: mm ?? null,
  };
}

export function normalizeLocalizedField(input: LocalizedFieldInput): LocalizedTextPair {
  return normalizeLocalizedFieldInternal(input);
}

export function normalizeLocalizedDescriptions(input: {
  description?: unknown;
  description_en?: unknown;
  description_mm?: unknown;
  english_description?: unknown;
  burmese_description?: unknown;
  description_json?: unknown;
}): LocalizedTextPair {
  return normalizeLocalizedFieldInternal({
    value: input.description,
    en: input.description_en,
    mm: input.description_mm,
    english: input.english_description,
    burmese: input.burmese_description,
    json: input.description_json,
  });
}

export function pickLocalizedText(
  language: LanguageKey,
  options: {
    en?: string | null;
    mm?: string | null;
    fallback?: string | null;
  }
): string {
  const normalized = typeof language === "string" ? language.toLowerCase() : "en";
  const preferMm = normalized.startsWith("mm");

  const primary = preferMm ? options.mm : options.en;
  const secondary = preferMm ? options.en : options.mm;
  const fallback = options.fallback ?? null;

  const primaryCleaned = toCleanString(primary);
  if (primaryCleaned) return primaryCleaned;

  const secondaryCleaned = toCleanString(secondary);
  if (secondaryCleaned) return secondaryCleaned;

  return toCleanString(fallback) ?? "";
}

export function coerceText(value: unknown, fallback: string | null = null): string | null {
  return toCleanString(value) ?? (fallback ? toCleanString(fallback) : null);
}

export function coerceTextOrEmpty(value: unknown, fallback: string | null = null): string {
  return coerceText(value, fallback) ?? "";
}