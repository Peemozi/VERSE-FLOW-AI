import type { CanonicalBookId } from "../../shared/scripture/books";

export interface ScriptureContext {
  bookId: CanonicalBookId | null;
  chapter: number | null;
  verse: number | null;
  updatedAt: number;
  /** Soft expiry — contextual detections weaken then drop. */
  expiresAt: number;
}

export interface ContextTrackerOptions {
  /** Default 3 minutes */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 3 * 60 * 1000;

export class ContextTracker {
  private ctx: ScriptureContext = {
    bookId: null,
    chapter: null,
    verse: null,
    updatedAt: 0,
    expiresAt: 0,
  };

  constructor(private readonly options: ContextTrackerOptions = {}) {}

  private ttl(): number {
    return this.options.ttlMs ?? DEFAULT_TTL_MS;
  }

  reset(): void {
    this.ctx = {
      bookId: null,
      chapter: null,
      verse: null,
      updatedAt: 0,
      expiresAt: 0,
    };
  }

  get(now = Date.now()): ScriptureContext | null {
    if (!this.ctx.bookId) return null;
    if (now > this.ctx.expiresAt) return null;
    return { ...this.ctx };
  }

  /** Strength 1 = fresh, 0 = expired. */
  strength(now = Date.now()): number {
    const ctx = this.get(now);
    if (!ctx) return 0;
    const span = this.ttl();
    const remaining = ctx.expiresAt - now;
    return Math.max(0, Math.min(1, remaining / span));
  }

  update(ref: {
    bookId: CanonicalBookId;
    chapter: number;
    verse: number;
  }, now = Date.now()): ScriptureContext {
    this.ctx = {
      bookId: ref.bookId,
      chapter: ref.chapter,
      verse: ref.verse,
      updatedAt: now,
      expiresAt: now + this.ttl(),
    };
    return { ...this.ctx };
  }

  snapshot(): ScriptureContext {
    return { ...this.ctx };
  }
}
