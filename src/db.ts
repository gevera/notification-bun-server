import Database from "bun:sqlite";
import { DB_PATH } from "./config";

export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode=WAL");
db.exec("PRAGMA foreign_keys=ON");

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL UNIQUE,
    verify_token TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Prepared statements ---
export const stmt = {
  insertProject: db.prepare(
    "INSERT INTO projects (uuid, domain, verify_token) VALUES (?, ?, ?)"
  ),
  getProjectByDomain: db.prepare("SELECT * FROM projects WHERE domain = ?"),
  getProjectByUuid: db.prepare("SELECT * FROM projects WHERE uuid = ?"),
  verifyProject: db.prepare(
    "UPDATE projects SET verified = 1 WHERE id = ?"
  ),
  insertNotification: db.prepare(
    "INSERT INTO notifications (project_id, payload) VALUES (?, ?)"
  ),
  getNotifications: db.prepare(
    "SELECT * FROM notifications WHERE project_id = ? ORDER BY created_at DESC LIMIT ?"
  ),
  getRecentCount: db.prepare(
    "SELECT COUNT(*) as count FROM notifications WHERE project_id = ? AND created_at > datetime('now', '-1 hour')"
  ),
};

// --- Helpers ---
export function isDomainValid(domain: string): boolean {
  return /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(domain);
}
