import { escapeXml } from "./config";

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
  /** When "phone", value is rendered as a tap-to-dial tel: link in the RSS feed */
  type?: "phone" | "text";
}

const PHONE_FIELD_KEYS = new Set([
  "telephone",
  "phone",
  "tel",
  "mobile",
  "cellphone",
  "cell",
  "phonenumber",
  "phone_number",
]);

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
      const entry: FieldMapping = {
        key: stripControlChars(f.key),
        label: stripControlChars(f.label),
      };
      if (f.type !== undefined) {
        if (f.type !== "phone" && f.type !== "text") return null;
        entry.type = f.type;
      }
      fields.push(entry);
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

function isPhoneField(field: FieldMapping): boolean {
  if (field.type === "phone") return true;
  if (field.type === "text") return false;
  return PHONE_FIELD_KEYS.has(field.key.toLowerCase());
}

function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

function looksLikePhone(value: string): boolean {
  return digitCount(value) >= 7;
}

/** E.164-style href for tel: links (digits, optional leading +) */
function normalizeTelHref(display: string): string | null {
  const trimmed = display.trim();
  if (!looksLikePhone(trimmed)) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;

  return hasPlus ? `+${digits}` : digits;
}

function formatPhoneLink(display: string): string {
  const tel = normalizeTelHref(display);
  if (!tel) return escapeXml(display);
  return `<a href="tel:${escapeXml(tel)}">${escapeXml(display)}</a>`;
}

function formatFieldValueHtml(field: FieldMapping, value: unknown): string {
  const raw =
    field.key === "time" ? formatDate(String(value)) : String(value);
  const display = raw.slice(0, MAX_PAYLOAD_VALUE_LEN);

  if (isPhoneField(field) && looksLikePhone(display)) {
    return formatPhoneLink(display);
  }
  return escapeXml(display);
}

/** ISO 8601 UTC timestamp for when the notification was stored (international) */
function formatCreatedAtIso(createdAt: string): string {
  const normalized = createdAt.includes("T")
    ? createdAt.endsWith("Z")
      ? createdAt
      : `${createdAt}Z`
    : `${createdAt.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return createdAt;
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatCreatedAtHtml(createdAt: string): string {
  const iso = formatCreatedAtIso(createdAt);
  return `<time datetime="${escapeXml(iso)}">${escapeXml(iso)}</time>`;
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

  // HTML description: created-at under title, then fields (RSS readers)
  const lines: string[] = [];
  if (createdAt) {
    lines.push(formatCreatedAtHtml(createdAt));
  }
  for (const field of fields) {
    const value = data[field.key];
    if (value === undefined) continue;
    lines.push(
      `${escapeXml(field.label)}: ${formatFieldValueHtml(field, value)}`
    );
  }

  return {
    title,
    description: lines.join("<br/>"),
  };
}
