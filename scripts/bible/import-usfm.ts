/**
 * Import WEB (World English Bible) and OYCB (Open Yoruba Contemporary Bible)
 * from licence-permitted local/remote sources into SQLite.
 *
 * Usage:
 *   npm run bible:import
 *   VERSEFLOW_DB_PATH=./data/verseflow.db npm run bible:import
 *
 * Does NOT invent translation text. If a source is missing, import skips it
 * and prints instructions — never labels fake text as WEB/OYCB.
 */
import fs from "node:fs";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";
import { BibleRepository, normalizedForSearch } from "../../src/main/database/BibleRepository";
import { MIGRATIONS } from "../../src/main/database/migrations";
import { parseUsfm } from "../../src/shared/scripture/usfm";

const ROOT = path.resolve(__dirname, "../..");
const RAW_DIR = path.join(ROOT, "resources", "bible", "raw");
const DB_PATH = process.env.VERSEFLOW_DB_PATH ?? path.join(ROOT, "data", "verseflow.db");

/** Public-domain WEB USFM bundle hosted by eBible.org */
const WEB_ZIP_URL = "https://ebible.org/Scriptures/engwebp_usfm.zip";

/**
 * OYCB (Biblica Yoruba Contemporary Bible) — CC BY-SA 4.0 on eBible.org.
 * Override with OYCB_ZIP_URL / OYCB_USFM_DIR if using another permitted source.
 */
const OYCB_ZIP_URL =
  process.env.OYCB_ZIP_URL ?? "https://ebible.org/Scriptures/yor_usfm.zip";
const SKIP_OYCB = process.env.SKIP_OYCB === "1";

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status} ${url}`);
  }
  ensureDir(path.dirname(dest));
  const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(dest));
}

function unzip(zipPath: string, destDir: string): void {
  ensureDir(destDir);
  // Windows has no `unzip`; its bundled bsdtar (tar.exe) extracts zip archives.
  const cmd =
    process.platform === "win32"
      ? `tar -xf "${zipPath}" -C "${destDir}"`
      : `unzip -o -q "${zipPath}" -d "${destDir}"`;
  execSync(cmd, { stdio: "inherit" });
}

function findUsfmFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(usfm|sfm)$/i.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

function openMigratedDb(dbPath: string): Database.Database {
  ensureDir(path.dirname(dbPath));
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((r) => (r as { id: string }).id),
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec(migration.sql);
    db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(migration.id);
  }
  return db;
}

async function ensureWebUsfm(): Promise<string> {
  const webDir = path.join(RAW_DIR, "web");
  const existing = findUsfmFiles(webDir);
  if (existing.length > 0) return webDir;

  const zipPath = path.join(RAW_DIR, "engwebp_usfm.zip");
  if (!fs.existsSync(zipPath)) {
    await downloadFile(WEB_ZIP_URL, zipPath);
  }
  unzip(zipPath, webDir);
  return webDir;
}

async function ensureOycbUsfm(): Promise<string | null> {
  if (SKIP_OYCB) {
    console.warn("SKIP_OYCB=1 — skipping OYCB import.");
    return null;
  }

  const oycbDir = process.env.OYCB_USFM_DIR
    ? path.resolve(process.env.OYCB_USFM_DIR)
    : path.join(RAW_DIR, "oycb");

  const existing = findUsfmFiles(oycbDir);
  if (existing.length > 0) return oycbDir;

  if (OYCB_ZIP_URL) {
    try {
      const zipPath = path.join(RAW_DIR, "yor_usfm.zip");
      if (!fs.existsSync(zipPath)) {
        await downloadFile(OYCB_ZIP_URL, zipPath);
      }
      unzip(zipPath, oycbDir);
      if (findUsfmFiles(oycbDir).length > 0) return oycbDir;
    } catch (err) {
      console.warn(
        `OYCB download/import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.warn(
    [
      "",
      "OYCB USFM not found.",
      `Place licence-permitted OYCB USFM files in: ${oycbDir}`,
      "Or set OYCB_USFM_DIR / OYCB_ZIP_URL to a permitted source.",
      "Import will continue with WEB only. No fake OYCB text will be inserted.",
      "",
    ].join("\n"),
  );
  return null;
}

function importTranslation(
  repo: BibleRepository,
  translation: {
    id: string;
    name: string;
    language: string;
    license: string;
    attribution: string;
  },
  usfmDir: string,
): number {
  repo.upsertTranslation(translation);
  repo.clearTranslationVerses(translation.id);

  const files = findUsfmFiles(usfmDir);
  const rows: Array<{
    translationId: string;
    bookId: string;
    chapter: number;
    verse: number;
    originalText: string;
    normalizedText: string;
  }> = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const v of parseUsfm(content)) {
      rows.push({
        translationId: translation.id,
        bookId: v.bookId,
        chapter: v.chapter,
        verse: v.verse,
        originalText: v.text,
        normalizedText: normalizedForSearch(v.text),
      });
    }
  }

  const count = repo.insertVerses(rows);
  console.log(`Imported ${count} verses for ${translation.id} from ${files.length} USFM files`);
  return count;
}

async function main(): Promise<void> {
  ensureDir(RAW_DIR);
  const db = openMigratedDb(DB_PATH);
  const repo = new BibleRepository(db);
  repo.seedCanonicalBooks();

  const webDir = await ensureWebUsfm();
  importTranslation(
    repo,
    {
      id: "WEB",
      name: "World English Bible",
      language: "en",
      license: "Public Domain",
      attribution:
        "World English Bible (WEB). Public domain. Source: eBible.org engwebp USFM.",
    },
    webDir,
  );

  const oycbDir = await ensureOycbUsfm();
  if (oycbDir) {
    importTranslation(
      repo,
      {
        id: "OYCB",
        name: "Open Yoruba Contemporary Bible",
        language: "yo",
        license: process.env.OYCB_LICENSE ?? "CC BY-SA 4.0",
        attribution:
          process.env.OYCB_ATTRIBUTION ??
          "Biblica® Open Yoruba Contemporary Bible (OYCB). Copyright © 2009, 2017 Biblica, Inc. CC BY-SA 4.0. Source: eBible.org yor USFM. Biblica® is a trademark of Biblica, Inc.",
      },
      oycbDir,
    );
  }

  for (const t of repo.listTranslations()) {
    console.log(`- ${t.id}: ${t.verseCount} verses (${t.license})`);
  }

  db.close();
  console.log(`Database: ${DB_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
