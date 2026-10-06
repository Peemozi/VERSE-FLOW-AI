import { findBookAliasesInText, type AliasLanguage } from "./bookAliasEngine";
import { digitizeSpokenNumbers, parseSpokenNumber, type NumberLanguage } from "./numberNormalizer";
import { parseReferences, type RawMatch } from "./referenceParser";
import { normalizeTranscript } from "./transcriptNormalizer";
import { normalizeForMatch } from "./yorubaNormalizer";

export interface ParsedNumberSpan {
  raw: string;
  value: number;
  /** Approximate token index after normalize */
  tokenIndex: number;
}

export interface YorubaDiagnosticResult {
  originalTranscript: string;
  normalizedTranscript: string;
  digitizedTranscript: string;
  matchedAliases: Array<{
    alias: string;
    bookId: string;
    language: AliasLanguage;
    source: string;
    start: number;
    end: number;
  }>;
  parsedNumbers: ParsedNumberSpan[];
  resolvedRefs: Array<{
    bookId: string;
    chapter: number;
    verse: number;
    endVerse?: number;
    rawMatch: string;
    matchedAlias?: string;
    aliasSource?: string;
    confidence: number;
    method: string;
  }>;
  topConfidence: number | null;
}

/**
 * Developer diagnostics for Yoruba / bilingual detection.
 * Surfaces original → normalized → alias → numbers → resolved ref + confidence.
 */
export function diagnoseTranscript(
  transcript: string,
  options: {
    languages?: AliasLanguage[];
    numberLanguage?: NumberLanguage;
  } = {},
): YorubaDiagnosticResult {
  const languages = options.languages ?? ["yo", "en"];
  const numberLanguage = options.numberLanguage ?? "yo";
  const originalTranscript = transcript;
  const normalizedTranscript = normalizeTranscript(transcript);
  const digitizedTranscript = digitizeSpokenNumbers(normalizedTranscript, numberLanguage);

  const matchedAliases = findBookAliasesInText(normalizedTranscript, languages).map((h) => ({
    alias: h.alias,
    bookId: h.bookId,
    language: h.language,
    source: h.source,
    start: h.start,
    end: h.end,
  }));

  const tokens = normalizeForMatch(normalizedTranscript).split(" ").filter(Boolean);
  const parsedNumbers: ParsedNumberSpan[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let len = Math.min(8, tokens.length - i); len >= 1; len--) {
      const slice = tokens.slice(i, i + len).join(" ");
      const value = parseSpokenNumber(slice, numberLanguage);
      if (value != null && !/^\d+$/.test(slice)) {
        parsedNumbers.push({ raw: slice, value, tokenIndex: i });
        break;
      }
    }
  }

  const refs: RawMatch[] = parseReferences(transcript, { languages, numberLanguage });
  const resolvedRefs = refs.map((r) => ({
    bookId: r.bookId,
    chapter: r.chapter,
    verse: r.verse,
    endVerse: r.endVerse,
    rawMatch: r.rawMatch,
    matchedAlias: r.matchedAlias,
    aliasSource: r.aliasSource,
    confidence: r.confidence,
    method: r.method,
  }));

  return {
    originalTranscript,
    normalizedTranscript,
    digitizedTranscript,
    matchedAliases,
    parsedNumbers,
    resolvedRefs,
    topConfidence: resolvedRefs[0]?.confidence ?? null,
  };
}
