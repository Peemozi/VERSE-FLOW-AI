import type Database from "better-sqlite3";
import { CANONICAL_BOOKS } from "../../shared/scripture/books";
import type { BibleSearchResult, BibleVerseDto, TranslationInfo } from "../../shared/schemas";
import type { BibleBookInfo } from "../../shared/types/ipc";

export interface UpsertVerseInput {
  translationId: string;
  bookId: string;
  chapter: number;
  verse: number;
  originalText: string;
  normalizedText: string;
}

export class BibleRepository {
  constructor(private readonly db: Database.Database) {}

  seedCanonicalBooks(): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO bible_books (id, name_en, sort_order, chapter_count, testament)
      VALUES (@id, @nameEn, @order, @chapters, @testament)
    `);
    const tx = this.db.transaction(() => {
      for (const book of CANONICAL_BOOKS) {
        stmt.run(book);
      }
    });
    tx();
  }

  upsertTranslation(info: {
    id: string;
    name: string;
    language: string;
    license: string;
    attribution: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO bible_translations (id, name, language, license, attribution)
         VALUES (@id, @name, @language, @license, @attribution)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           language = excluded.language,
           license = excluded.license,
           attribution = excluded.attribution`,
      )
      .run(info);
  }

  clearTranslationVerses(translationId: string): void {
    this.db.prepare("DELETE FROM bible_verses WHERE translation_id = ?").run(translationId);
    if (this.hasFtsTable()) {
      this.db.prepare("DELETE FROM bible_verses_fts WHERE translation_id = ?").run(translationId);
    }
  }

  insertVerses(verses: UpsertVerseInput[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO bible_verses (translation_id, book_id, chapter, verse, original_text, normalized_text)
      VALUES (@translationId, @bookId, @chapter, @verse, @originalText, @normalizedText)
      ON CONFLICT(translation_id, book_id, chapter, verse) DO UPDATE SET
        original_text = excluded.original_text,
        normalized_text = excluded.normalized_text
    `);
    const tx = this.db.transaction((rows: UpsertVerseInput[]) => {
      for (const row of rows) stmt.run(row);
      return rows.length;
    });
    const count = tx(verses);
    const translationIds = [...new Set(verses.map((v) => v.translationId))];
    for (const tid of translationIds) {
      this.rebuildFtsForTranslation(tid);
    }
    return count;
  }

  /** Rebuild FTS5 index for one translation (idempotent). */
  rebuildFtsForTranslation(translationId: string): void {
    if (!this.hasFtsTable()) return;
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM bible_verses_fts WHERE translation_id = ?").run(translationId);
      this.db
        .prepare(
          `INSERT INTO bible_verses_fts (rowid, normalized_text, translation_id, book_id, chapter, verse)
           SELECT id, normalized_text, translation_id, book_id, chapter, verse
           FROM bible_verses WHERE translation_id = ?`,
        )
        .run(translationId);
    });
    tx();
  }

  rebuildAllFts(): void {
    if (!this.hasFtsTable()) return;
    for (const t of this.listTranslations()) {
      this.rebuildFtsForTranslation(t.id);
    }
  }

  private hasFtsTable(): boolean {
    const row = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bible_verses_fts'`,
      )
      .get() as { name: string } | undefined;
    return Boolean(row);
  }

  /**
   * FTS5 quotation search. Returns ranked lexical candidates.
   * Query should already be normalized; stopwords stripped by caller for MATCH.
   */
  searchQuotation(
    translationId: string,
    ftsQuery: string,
    limit = 8,
  ): Array<{
    translationId: string;
    bookId: string;
    bookName: string;
    chapter: number;
    verse: number;
    originalText: string;
    normalizedText: string;
    rank: number;
  }> {
    if (!this.hasFtsTable() || !ftsQuery.trim()) return [];
    try {
      const rows = this.db
        .prepare(
          `SELECT v.translation_id AS translationId, v.book_id AS bookId, b.name_en AS bookName,
                  v.chapter, v.verse, v.original_text AS originalText, v.normalized_text AS normalizedText,
                  bm25(bible_verses_fts) AS rank
           FROM bible_verses_fts
           JOIN bible_verses v ON v.id = bible_verses_fts.rowid
           JOIN bible_books b ON b.id = v.book_id
           WHERE bible_verses_fts.translation_id = ?
             AND bible_verses_fts MATCH ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(translationId, ftsQuery, limit) as Array<{
        translationId: string;
        bookId: string;
        bookName: string;
        chapter: number;
        verse: number;
        originalText: string;
        normalizedText: string;
        rank: number;
      }>;
      return rows;
    } catch {
      // Bad FTS syntax — never throw into detection path
      return [];
    }
  }

  listTranslations(): TranslationInfo[] {
    const rows = this.db
      .prepare(
        `SELECT t.id, t.name, t.language, t.license, t.attribution,
                COALESCE(COUNT(v.id), 0) AS verseCount
         FROM bible_translations t
         LEFT JOIN bible_verses v ON v.translation_id = t.id
         GROUP BY t.id
         ORDER BY t.id`,
      )
      .all() as Array<{
      id: string;
      name: string;
      language: string;
      license: string;
      attribution: string;
      verseCount: number;
    }>;
    return rows;
  }

  listBooks(): BibleBookInfo[] {
    const rows = this.db
      .prepare(
        `SELECT id, name_en AS nameEn, sort_order AS "order", chapter_count AS chapters, testament
         FROM bible_books ORDER BY sort_order`,
      )
      .all() as BibleBookInfo[];
    return rows;
  }

  getVerse(translationId: string, bookId: string, chapter: number, verse: number): BibleVerseDto | null {
    const row = this.db
      .prepare(
        `SELECT v.translation_id AS translationId, v.book_id AS bookId, v.chapter, v.verse,
                v.original_text AS originalText, b.name_en AS bookName
         FROM bible_verses v
         JOIN bible_books b ON b.id = v.book_id
         WHERE v.translation_id = ? AND v.book_id = ? AND v.chapter = ? AND v.verse = ?`,
      )
      .get(translationId, bookId, chapter, verse) as
      | {
          translationId: string;
          bookId: string;
          chapter: number;
          verse: number;
          originalText: string;
          bookName: string;
        }
      | undefined;

    if (!row) return null;
    return {
      translationId: row.translationId,
      bookId: row.bookId,
      chapter: row.chapter,
      verse: row.verse,
      originalText: row.originalText,
      referenceLabel: `${row.bookName} ${row.chapter}:${row.verse}`,
    };
  }

  search(translationId: string, query: string, limit = 25): BibleSearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const refMatch = trimmed.match(/^([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/);
    if (refMatch) {
      return this.searchByReferenceHint(translationId, trimmed, limit);
    }

    const like = `%${normalizedForSearch(trimmed)}%`;
    const rows = this.db
      .prepare(
        `SELECT v.translation_id AS translationId, v.book_id AS bookId, b.name_en AS bookName,
                v.chapter, v.verse, v.original_text AS originalText
         FROM bible_verses v
         JOIN bible_books b ON b.id = v.book_id
         WHERE v.translation_id = ? AND v.normalized_text LIKE ?
         ORDER BY b.sort_order, v.chapter, v.verse
         LIMIT ?`,
      )
      .all(translationId, like, limit) as Array<{
      translationId: string;
      bookId: string;
      bookName: string;
      chapter: number;
      verse: number;
      originalText: string;
    }>;

    return rows.map((row) => ({
      ...row,
      referenceLabel: `${row.bookName} ${row.chapter}:${row.verse}`,
    }));
  }

  private searchByReferenceHint(translationId: string, query: string, limit: number): BibleSearchResult[] {
    const m = query.match(/^([1-3]?\s*[A-Za-z.]+)\s+(\d+):(\d+)/i);
    if (!m) return [];
    const bookHint = m[1].replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();
    const chapter = Number(m[2]);
    const verse = Number(m[3]);

    const books = this.listBooks();
    const book = books.find(
      (b) =>
        b.nameEn.toLowerCase() === bookHint ||
        b.nameEn.toLowerCase().startsWith(bookHint) ||
        b.id.toLowerCase() === bookHint.replace(/\s/g, ""),
    );
    if (!book) return [];

    const verseDto = this.getVerse(translationId, book.id, chapter, verse);
    if (!verseDto) return [];
    return [
      {
        translationId: verseDto.translationId,
        bookId: verseDto.bookId,
        bookName: book.nameEn,
        chapter: verseDto.chapter,
        verse: verseDto.verse,
        originalText: verseDto.originalText,
        referenceLabel: verseDto.referenceLabel,
      },
    ].slice(0, limit);
  }

  getFtsCount(translationId: string): number {
    if (!this.hasFtsTable()) return 0;
    const row = this.db
      .prepare("SELECT COUNT(*) AS c FROM bible_verses_fts WHERE translation_id = ?")
      .get(translationId) as { c: number };
    return row.c;
  }

  getVerseCount(translationId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS c FROM bible_verses WHERE translation_id = ?")
      .get(translationId) as { c: number };
    return row.c;
  }
}

export function normalizedForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
