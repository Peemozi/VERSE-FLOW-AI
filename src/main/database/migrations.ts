export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: "001_initial",
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS bible_translations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        language TEXT NOT NULL,
        license TEXT NOT NULL,
        attribution TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS bible_books (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        chapter_count INTEGER NOT NULL,
        testament TEXT NOT NULL CHECK (testament IN ('OT', 'NT'))
      );

      CREATE TABLE IF NOT EXISTS bible_verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        translation_id TEXT NOT NULL REFERENCES bible_translations(id) ON DELETE CASCADE,
        book_id TEXT NOT NULL REFERENCES bible_books(id),
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        original_text TEXT NOT NULL,
        normalized_text TEXT NOT NULL,
        UNIQUE (translation_id, book_id, chapter, verse)
      );

      CREATE INDEX IF NOT EXISTS idx_verses_lookup
        ON bible_verses (translation_id, book_id, chapter, verse);
      CREATE INDEX IF NOT EXISTS idx_verses_normalized
        ON bible_verses (translation_id, normalized_text);

      CREATE TABLE IF NOT EXISTS book_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id TEXT NOT NULL REFERENCES bible_books(id) ON DELETE CASCADE,
        language TEXT NOT NULL,
        alias TEXT NOT NULL,
        UNIQUE (language, alias)
      );

      CREATE INDEX IF NOT EXISTS idx_aliases_lang ON book_aliases (language, alias);

      CREATE TABLE IF NOT EXISTS detection_sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        language_mode TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT REFERENCES detection_sessions(id) ON DELETE SET NULL,
        method TEXT NOT NULL CHECK (method IN ('direct', 'contextual', 'quotation', 'semantic', 'manual')),
        book_id TEXT,
        chapter INTEGER,
        verse INTEGER,
        end_verse INTEGER,
        confidence REAL,
        transcript_snippet TEXT,
        translation_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_detections_session ON detections (session_id, created_at);
    `,
  },
];
