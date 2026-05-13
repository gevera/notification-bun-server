/**
 * Format a raw JSON notification payload into a human-readable string.
 *
 * format_config per project is a JSON object like:
 * {
 *   "title_template": "Новая заявка от \"{name}\"",
 *   "fields": [
 *     { "key": "telephone", "label": "Телефон" },
 *     { "key": "message", "label": "Сообщение" }
 *   ]
 * }
 *
 * If no format_config is set, falls back to a sensible default
 * that handles common field names (name, telephone, message, time, group).
 */

export interface FieldMapping {
  key: string;
  label: string;
}

export interface FormatConfig {
  title_template?: string;
  fields?: FieldMapping[];
}

/** Escape special regex characters so user input can't craft catastrophic patterns */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip control characters from a string */
function stripControlChars(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1f\x7f]/g, "");
}

const MAX_TITLE_TEMPLATE_LEN = 500;
const MAX_FIELD_KEY_LEN = 64;
const MAX_FIELD_LABEL_LEN = 128;
const MAX_FIELDS_COUNT = 20;
const MAX_PAYLOAD_VALUE_LEN = 10_000;

/** Validate and sanitize a FormatConfig from user input. Returns null if invalid. */
export function sanitizeFormatConfig(raw: unknown): FormatConfig | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const config: FormatConfig = {};

  if (obj.title_template !== undefined) {
    if (typeof obj.title_template !== "string") return null;
    if (obj.title_template.length > MAX_TITLE_TEMPLATE_LEN) return null;
    config.title_template = stripControlChars(obj.title_template);
  }

  if (obj.fields !== undefined) {
    if (!Array.isArray(obj.fields)) return null;
    if (obj.fields.length > MAX_FIELDS_COUNT) return null;

    const fields: FieldMapping[] = [];
    for (const f of obj.fields) {
      if (typeof f !== "object" || f === null) return null;
      if (typeof f.key !== "string" || typeof f.label !== "string") return null;
      if (f.key.length > MAX_FIELD_KEY_LEN) return null;
      if (f.label.length > MAX_FIELD_LABEL_LEN) return null;
      fields.push({
        key: stripControlChars(f.key),
        label: stripControlChars(f.label),
      });
    }
    config.fields = fields;
  }

  return config;
}

/** Default field mapping for the common booking-style payload */
const DEFAULT_FIELDS: FieldMapping[] = [
  { key: "name", label: "Имя" },
  { key: "telephone", label: "Телефон" },
  { key: "message", label: "Сообщение" },
];

/**
 * Parse a date string flexibly. Handles:
 *  - ISO strings
 *  - "M/D/YYYY, H:MM:SS AM/PM" (US locale)
 *  - SQLite datetime "YYYY-MM-DD HH:MM:SS"
 */
function parseDate(raw: string): Date | null {
  // Try direct parse first
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;

  // US locale: "5/13/2026, 9:04:27 PM"
  const usMatch = raw.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)/i
  );
  if (usMatch) {
    let h = parseInt(usMatch[4]!, 10);
    const min = usMatch[5]!;
    const sec = usMatch[6]!;
    const ampm = usMatch[7]!.toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const parsed = new Date(
      parseInt(usMatch[3]!, 10),
      parseInt(usMatch[1]!, 10) - 1,
      parseInt(usMatch[2]!, 10),
      h,
      parseInt(min, 10),
      parseInt(sec, 10)
    );
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/** Format date as "HH:MM DD/MM/YYYY" */
function formatDate(raw: string): string {
  const d = parseDate(raw);
  if (!d) return raw;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

/**
 * Format a notification payload into a human-readable title and description.
 */
export function formatNotification(
  payload: string,
  createdAt: string,
  config: FormatConfig | null
): { title: string; description: string } {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return { title: "Уведомление", description: payload };
  }

  const fields = config?.fields ?? DEFAULT_FIELDS;
  const titleTemplate =
    config?.title_template ?? 'Новая заявка от "{name}"';

  // Build title by replacing {key} placeholders
  let title = titleTemplate;
  for (const [key, val] of Object.entries(data)) {
    const safeKey = escapeRegex(key);
    title = title.replace(
      new RegExp(`\\{${safeKey}\\}`, "g"),
      String(val ?? "").slice(0, MAX_PAYLOAD_VALUE_LEN)
    );
  }

  // Build description lines from configured fields
  const lines: string[] = [];
  for (const field of fields) {
    const value = data[field.key];
    if (value === undefined) continue;

    // Special formatting for time-like fields
    const strValue =
      field.key === "time" ? formatDate(String(value)) : String(value);
    lines.push(`${field.label}: ${strValue}`);
  }

  // Add created_at timestamp if not already in the payload
  if (data.time === undefined && createdAt) {
    lines.push(`Время: ${formatDate(createdAt + "Z")}`);
  }

  return {
    title,
    description: lines.join("\n"),
  };
}
