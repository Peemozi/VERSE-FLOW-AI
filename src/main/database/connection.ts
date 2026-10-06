import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { logger } from "../security/logger";
import { MIGRATIONS } from "./migrations";

let db: Database.Database | null = null;

export function getUserDataPath(): string {
  if (process.env.VERSEFLOW_DATA_DIR) {
    return process.env.VERSEFLOW_DATA_DIR;
  }
  try {
    // Lazy require so Vitest / Node scripts do not need Electron at import time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require("electron") as { app?: { getPath: (name: string) => string } };
    if (electron.app?.getPath) {
      return electron.app.getPath("userData");
    }
  } catch {
    // running outside Electron
  }
  return path.join(process.cwd(), "data");
}

export function getDbPath(): string {
  if (process.env.VERSEFLOW_DB_PATH) return process.env.VERSEFLOW_DB_PATH;
  const localDevDb = path.join(process.cwd(), "data", "verseflow.db");
  if (fs.existsSync(localDevDb)) return localDevDb;
  return path.join(getUserDataPath(), "verseflow.db");
}

export function openDatabase(dbPath = getDbPath()): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  logger.info("SQLite opened", { path: dbPath });
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) return openDatabase();
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    database.prepare("SELECT id FROM schema_migrations").all().map((r) => (r as { id: string }).id),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const tx = database.transaction(() => {
      database.exec(migration.sql);
      database.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(migration.id);
    });
    tx();
    logger.info("Applied migration", { id: migration.id });
  }
}

/** For tests — open an in-memory or temp DB without Electron app. */
export function openTestDatabase(dbPath = ":memory:"): Database.Database {
  if (db) {
    db.close();
    db = null;
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
