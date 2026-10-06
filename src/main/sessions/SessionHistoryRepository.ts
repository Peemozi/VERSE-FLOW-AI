import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type OperatorEventKind =
  | "detection"
  | "preview"
  | "queue_add"
  | "live"
  | "clear_live"
  | "manual_search";

export interface OperatorEventInput {
  kind: OperatorEventKind;
  bookId?: string | null;
  chapter?: number | null;
  verse?: number | null;
  endVerse?: number | null;
  referenceLabel?: string | null;
  translationId?: string | null;
  verseText?: string | null;
  confidence?: number | null;
  method?: string | null;
  notes?: string | null;
}

export interface OperatorEventRow {
  id: number;
  sessionId: string;
  kind: OperatorEventKind;
  bookId: string | null;
  chapter: number | null;
  verse: number | null;
  endVerse: number | null;
  referenceLabel: string | null;
  translationId: string | null;
  verseText: string | null;
  confidence: number | null;
  method: string | null;
  notes: string | null;
  createdAt: string;
}

export class SessionHistoryRepository {
  private activeSessionId: string | null = null;

  constructor(private readonly db: Database.Database) {}

  ensureSession(languageMode?: string): string {
    if (this.activeSessionId) return this.activeSessionId;
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO detection_sessions (id, language_mode) VALUES (?, ?)`,
      )
      .run(id, languageMode ?? null);
    this.activeSessionId = id;
    return id;
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  endSession(): void {
    if (!this.activeSessionId) return;
    this.db
      .prepare(`UPDATE detection_sessions SET ended_at = datetime('now') WHERE id = ?`)
      .run(this.activeSessionId);
    this.activeSessionId = null;
  }

  record(event: OperatorEventInput, languageMode?: string): OperatorEventRow {
    const sessionId = this.ensureSession(languageMode);
    const result = this.db
      .prepare(
        `INSERT INTO operator_events (
          session_id, kind, book_id, chapter, verse, end_verse,
          reference_label, translation_id, verse_text, confidence, method, notes
        ) VALUES (
          @sessionId, @kind, @bookId, @chapter, @verse, @endVerse,
          @referenceLabel, @translationId, @verseText, @confidence, @method, @notes
        )`,
      )
      .run({
        sessionId,
        kind: event.kind,
        bookId: event.bookId ?? null,
        chapter: event.chapter ?? null,
        verse: event.verse ?? null,
        endVerse: event.endVerse ?? null,
        referenceLabel: event.referenceLabel ?? null,
        translationId: event.translationId ?? null,
        verseText: event.verseText ?? null,
        confidence: event.confidence ?? null,
        method: event.method ?? null,
        notes: event.notes ?? null,
      });

    return this.getById(Number(result.lastInsertRowid))!;
  }

  getById(id: number): OperatorEventRow | null {
    const row = this.db
      .prepare(
        `SELECT id, session_id AS sessionId, kind, book_id AS bookId, chapter, verse,
                end_verse AS endVerse, reference_label AS referenceLabel,
                translation_id AS translationId, verse_text AS verseText,
                confidence, method, notes, created_at AS createdAt
         FROM operator_events WHERE id = ?`,
      )
      .get(id) as OperatorEventRow | undefined;
    return row ?? null;
  }

  list(limit = 200): OperatorEventRow[] {
    return this.db
      .prepare(
        `SELECT id, session_id AS sessionId, kind, book_id AS bookId, chapter, verse,
                end_verse AS endVerse, reference_label AS referenceLabel,
                translation_id AS translationId, verse_text AS verseText,
                confidence, method, notes, created_at AS createdAt
         FROM operator_events
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(limit) as OperatorEventRow[];
  }

  listSessions(): Array<{ id: string; startedAt: string; endedAt: string | null; eventCount: number }> {
    return this.db
      .prepare(
        `SELECT s.id, s.started_at AS startedAt, s.ended_at AS endedAt,
                COUNT(e.id) AS eventCount
         FROM detection_sessions s
         LEFT JOIN operator_events e ON e.session_id = s.id
         GROUP BY s.id
         ORDER BY s.started_at DESC
         LIMIT 50`,
      )
      .all() as Array<{ id: string; startedAt: string; endedAt: string | null; eventCount: number }>;
  }
}
