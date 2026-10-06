import type { CanonicalBookId } from "../../shared/scripture/books";
import type { AliasLanguage } from "./bookAliasEngine";
import { scoreConfidence, type DetectionMethod } from "./confidence";
import type { ScriptureContext } from "./contextTracker";
import { digitizeSpokenNumbers, type NumberLanguage } from "./numberNormalizer";
import { resolveBookHint } from "./resolveBookHint";
import { validateReference, type ParsedReference } from "./referenceValidator";
import { normalizeTranscript } from "./transcriptNormalizer";

export interface RawMatch {
  method: DetectionMethod;
  bookId: CanonicalBookId;
  chapter: number;
  verse: number;
  endVerse?: number;
  rawMatch: string;
  start: number;
  end: number;
  hasExplicitPunctuation: boolean;
  isSpokenForm: boolean;
  aliasLanguage?: AliasLanguage;
  confidence: number;
}

export interface ParseOptions {
  languages?: AliasLanguage[];
  numberLanguage?: NumberLanguage;
  context?: ScriptureContext | null;
  contextStrength?: number;
}

const DIRECT_COMPACT =
  /\b([1-3]?(?:\s*[a-z][a-z']*)(?:\s+[a-z][a-z']*){0,4})\s+(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?\b/gi;

const DIRECT_SPOKEN =
  /\b([1-3]?(?:\s*[a-z][a-z']*)(?:\s+[a-z][a-z']*){0,4})\s+(?:chapter\s+)?(\d{1,3})\s+(?:verse|verses)\s+(\d{1,3})(?:\s*(?:to|through|-)\s*(\d{1,3}))?\b/gi;

const CONTEXT_VERSE =
  /\b(?:verse|verses)\s+(\d{1,3})(?:\s*(?:to|through|-)\s*(\d{1,3}))?\b/gi;

const CONTEXT_CHAPTER_VERSE =
  /\bchapter\s+(\d{1,3})\s+(?:verse|verses)\s+(\d{1,3})(?:\s*(?:to|through|-)\s*(\d{1,3}))?\b/gi;

function tryPush(
  out: RawMatch[],
  partial: Omit<RawMatch, "confidence">,
  aliasScore: number,
  contextStrength?: number,
): void {
  const validated = validateReference(partial);
  if (!validated.ok || !validated.ref) return;
  out.push({
    ...partial,
    bookId: validated.ref.bookId,
    chapter: validated.ref.chapter,
    verse: validated.ref.verse,
    endVerse: validated.ref.endVerse,
    confidence: scoreConfidence({
      method: partial.method,
      aliasScore,
      contextStrength,
      hasExplicitPunctuation: partial.hasExplicitPunctuation,
      isSpokenForm: partial.isSpokenForm,
      hasRange: validated.ref.endVerse != null,
    }),
  });
}

export function parseReferences(transcript: string, options: ParseOptions = {}): RawMatch[] {
  const languages = options.languages ?? ["en", "yo"];
  const numberLanguage = options.numberLanguage ?? "auto";
  const normalized = digitizeSpokenNumbers(normalizeTranscript(transcript), numberLanguage);
  const results: RawMatch[] = [];
  const occupied: boolean[] = Array.from({ length: normalized.length }, () => false);

  const mark = (start: number, end: number) => {
    for (let i = start; i < end; i++) occupied[i] = true;
  };
  const free = (start: number, end: number) => !occupied.slice(start, end).some(Boolean);

  for (const re of [DIRECT_COMPACT, DIRECT_SPOKEN]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(normalized)) !== null) {
      const resolved = resolveBookHint(m[1], languages);
      if (!resolved) continue;
      const start = m.index;
      const end = m.index + m[0].length;
      if (!free(start, end)) continue;
      tryPush(
        results,
        {
          method: "direct",
          bookId: resolved.bookId,
          chapter: Number(m[2]),
          verse: Number(m[3]),
          endVerse: m[4] ? Number(m[4]) : undefined,
          rawMatch: m[0],
          start,
          end,
          hasExplicitPunctuation: m[0].includes(":"),
          isSpokenForm: /chapter|verse/.test(m[0]),
          aliasLanguage: resolved.language,
        },
        resolved.aliasScore,
      );
      mark(start, end);
    }
  }

  const ctx = options.context;
  if (ctx?.bookId) {
    CONTEXT_CHAPTER_VERSE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CONTEXT_CHAPTER_VERSE.exec(normalized)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (!free(start, end)) continue;
      tryPush(
        results,
        {
          method: "contextual",
          bookId: ctx.bookId,
          chapter: Number(m[1]),
          verse: Number(m[2]),
          endVerse: m[3] ? Number(m[3]) : undefined,
          rawMatch: m[0],
          start,
          end,
          hasExplicitPunctuation: false,
          isSpokenForm: true,
        },
        0.85,
        options.contextStrength ?? 1,
      );
      mark(start, end);
    }

    CONTEXT_VERSE.lastIndex = 0;
    while ((m = CONTEXT_VERSE.exec(normalized)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (!free(start, end)) continue;
      if (ctx.chapter == null) continue;
      tryPush(
        results,
        {
          method: "contextual",
          bookId: ctx.bookId,
          chapter: ctx.chapter,
          verse: Number(m[1]),
          endVerse: m[2] ? Number(m[2]) : undefined,
          rawMatch: m[0],
          start,
          end,
          hasExplicitPunctuation: false,
          isSpokenForm: true,
        },
        0.8,
        options.contextStrength ?? 1,
      );
      mark(start, end);
    }
  }

  return results.sort((a, b) => a.start - b.start);
}

export function formatReferenceLabel(ref: ParsedReference, bookName: string): string {
  const base = `${bookName} ${ref.chapter}:${ref.verse}`;
  if (ref.endVerse != null && ref.endVerse !== ref.verse) {
    return `${base}-${ref.endVerse}`;
  }
  return base;
}
