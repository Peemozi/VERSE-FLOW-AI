import { CANONICAL_BOOKS, type CanonicalBookId } from "../../shared/scripture/books";

export interface ParsedReference {
  bookId: CanonicalBookId;
  chapter: number;
  verse: number;
  endVerse?: number;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  ref?: ParsedReference;
}

const bookById = new Map(CANONICAL_BOOKS.map((b) => [b.id, b]));

export function validateReference(ref: {
  bookId: string;
  chapter: number;
  verse: number;
  endVerse?: number;
}): ValidationResult {
  const book = bookById.get(ref.bookId as CanonicalBookId);
  if (!book) {
    return { ok: false, reason: `Unknown book: ${ref.bookId}` };
  }
  if (!Number.isInteger(ref.chapter) || ref.chapter < 1) {
    return { ok: false, reason: "Chapter must be a positive integer" };
  }
  if (ref.chapter > book.chapters) {
    return {
      ok: false,
      reason: `${book.nameEn} has only ${book.chapters} chapters (got ${ref.chapter})`,
    };
  }
  if (!Number.isInteger(ref.verse) || ref.verse < 1) {
    return { ok: false, reason: "Verse must be a positive integer" };
  }
  if (ref.verse > 176) {
    return { ok: false, reason: `Verse ${ref.verse} exceeds known maximum (176)` };
  }
  if (ref.endVerse != null) {
    if (!Number.isInteger(ref.endVerse) || ref.endVerse < 1) {
      return { ok: false, reason: "End verse must be a positive integer" };
    }
    if (ref.endVerse < ref.verse) {
      return { ok: false, reason: "End verse must be >= start verse" };
    }
    if (ref.endVerse > 176) {
      return { ok: false, reason: `End verse ${ref.endVerse} exceeds known maximum (176)` };
    }
  }

  return {
    ok: true,
    ref: {
      bookId: book.id,
      chapter: ref.chapter,
      verse: ref.verse,
      ...(ref.endVerse != null ? { endVerse: ref.endVerse } : {}),
    },
  };
}

/** Optional: confirm the primary verse exists in a loaded translation. */
export function validateAgainstDb(
  ref: ParsedReference,
  lookup: (bookId: string, chapter: number, verse: number) => boolean,
): ValidationResult {
  const base = validateReference(ref);
  if (!base.ok || !base.ref) return base;
  if (!lookup(base.ref.bookId, base.ref.chapter, base.ref.verse)) {
    return {
      ok: false,
      reason: `Verse not found in Bible DB: ${base.ref.bookId} ${base.ref.chapter}:${base.ref.verse}`,
    };
  }
  if (base.ref.endVerse != null) {
    if (!lookup(base.ref.bookId, base.ref.chapter, base.ref.endVerse)) {
      return {
        ok: false,
        reason: `End verse not found in Bible DB: ${base.ref.bookId} ${base.ref.chapter}:${base.ref.endVerse}`,
      };
    }
  }
  return base;
}
