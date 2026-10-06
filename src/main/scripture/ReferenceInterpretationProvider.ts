import type { CanonicalBookId } from "../../shared/scripture/books";

/**
 * Optional LLM / heuristic interpreter for ambiguous spoken references.
 * Results MUST be validated against the local Bible DB before surfacing.
 * Core app works with NoOp — never require network or API keys.
 */
export interface InterpretedReference {
  bookId: CanonicalBookId | string;
  chapter: number;
  verse: number;
  endVerse?: number;
  confidence: number;
  /** Non-secret rationale for diagnostics (never log API keys). */
  rationale?: string;
}

export interface ReferenceInterpretationProvider {
  readonly id: string;
  readonly available: boolean;
  readonly displayName: string;
  interpret(transcript: string): Promise<InterpretedReference[]>;
}

export class NoOpReferenceInterpretationProvider implements ReferenceInterpretationProvider {
  readonly id = "noop-llm";
  readonly available = false;
  readonly displayName = "No LLM interpreter (stub)";

  async interpret(_transcript: string): Promise<InterpretedReference[]> {
    return [];
  }
}

export function createReferenceInterpretationProvider(): ReferenceInterpretationProvider {
  // Future: wire an optional provider behind env + settings; never default-on.
  return new NoOpReferenceInterpretationProvider();
}

/**
 * Keep only interpretations that exist in the local Bible DB.
 * Call this before any UI / live output of LLM suggestions.
 */
export function validateInterpretedReferences(
  refs: InterpretedReference[],
  verseExists: (bookId: string, chapter: number, verse: number) => boolean,
): InterpretedReference[] {
  return refs.filter((r) => {
    if (!r.bookId || r.chapter < 1 || r.verse < 1) return false;
    if (r.endVerse != null && r.endVerse < r.verse) return false;
    if (!verseExists(r.bookId, r.chapter, r.verse)) return false;
    if (r.endVerse != null && !verseExists(r.bookId, r.chapter, r.endVerse)) return false;
    return true;
  });
}
