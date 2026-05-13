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

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
