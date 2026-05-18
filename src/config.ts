import { randomUUID } from "crypto";

// --- Env ---
export const ADMIN_SECRET = process.env.ADMIN_SECRET;
export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
export const DB_PATH = process.env.DB_PATH || "./notifications.db";
export const PORT = parseInt(process.env.PORT || "3000", 10);

// --- Limits ---
export const MAX_FEED_ITEMS = 200;
export const RATE_LIMIT_MAX = 100;
export const RATE_LIMIT_DURATION_MS = 3_600_000; // 1 hour

// --- Validation ---
if (!ADMIN_SECRET) {
  console.error("ADMIN_SECRET env variable is required");
  process.exit(1);
}

// --- Helpers ---
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateUuid(): string {
  return randomUUID();
}

/** Strip characters illegal in XML 1.0 (Android XmlPullParser rejects these) */
export function sanitizeXmlChars(str: string): string {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export function escapeXml(str: string): string {
  return sanitizeXmlChars(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 822 pubDate for RSS (FeedFlow / XmlPullParser require a valid date) */
export function formatRfc822Date(createdAt: string): string {
  const normalized = createdAt.includes("T")
    ? createdAt.endsWith("Z")
      ? createdAt
      : `${createdAt}Z`
    : `${createdAt.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}
