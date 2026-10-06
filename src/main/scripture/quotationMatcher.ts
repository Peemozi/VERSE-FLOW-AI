import { normalizedForSearch } from "../database/BibleRepository";

/** Tiny / liturgical filler phrases that must not trigger quotation suggestions. */
const GENERIC_PHRASES = new Set(
  [
    "god is good",
    "thank you lord",
    "thank you jesus",
    "praise the lord",
    "praise god",
    "glory to god",
    "hallelujah",
    "halleluiah",
    "amen",
    "amen and amen",
    "yes lord",
    "oh lord",
    "in jesus name",
    "in jesus name amen",
    "god bless you",
    "good morning",
    "good evening",
    "let us pray",
    "shall we pray",
    "brothers and sisters",
  ].map((p) => normalizedForSearch(p)),
);

const STOPWORDS = new Set(
  [
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "of",
    "to",
    "in",
    "on",
    "for",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "that",
    "this",
    "these",
    "those",
    "it",
    "as",
    "at",
    "by",
    "from",
    "with",
    "he",
    "she",
    "they",
    "we",
    "you",
    "i",
    "his",
    "her",
    "their",
    "our",
    "your",
    "not",
    "no",
    "so",
    "if",
    "then",
    "than",
    "into",
    "unto",
    "shall",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "do",
    "does",
    "did",
    "have",
    "has",
    "had",
    "him",
    "them",
    "us",
    "me",
    "my",
    "also",
    "all",
    "any",
    "who",
    "whom",
    "which",
    "what",
    "when",
    "where",
    "there",
    "here",
    "said",
    "say",
    "says",
  ].map((w) => w),
);

export interface QuotationSettings {
  enabled: boolean;
  /** Minimum characters in a candidate phrase (default 40). */
  minChars: number;
  /** Minimum significant (non-stopword) tokens (default 6). */
  minSignificantWords: number;
  /** Max FTS hits to re-rank (default 8). */
  maxCandidates: number;
}

export const DEFAULT_QUOTATION_SETTINGS: QuotationSettings = {
  enabled: true,
  minChars: 40,
  minSignificantWords: 6,
  maxCandidates: 8,
};

/**
 * Rolling buffer of recent transcript sentences for quotation matching.
 * Direct reference detection does not use this — quotation only.
 */
export class TranscriptSentenceBuffer {
  private chunks: string[] = [];

  constructor(private readonly maxChunks = 6) {}

  reset(): void {
    this.chunks = [];
  }

  /** Push a final (or simulated) transcript; returns candidate phrase windows. */
  push(transcript: string): string[] {
    const cleaned = transcript.replace(/\s+/g, " ").trim();
    if (!cleaned) return this.candidates();

    const parts = cleaned
      .split(/(?<=[.!?…])\s+|\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      this.chunks.push(cleaned);
    } else {
      for (const p of parts) this.chunks.push(p);
    }

    while (this.chunks.length > this.maxChunks) this.chunks.shift();
    return this.candidates();
  }

  /** Current candidate windows: each sentence + last 2–3 joined. */
  candidates(): string[] {
    const out: string[] = [];
    for (const c of this.chunks) out.push(c);
    if (this.chunks.length >= 2) {
      out.push(this.chunks.slice(-2).join(" "));
    }
    if (this.chunks.length >= 3) {
      out.push(this.chunks.slice(-3).join(" "));
    }
    return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
  }
}

export function significantTokens(text: string): string[] {
  const norm = normalizedForSearch(text);
  return norm
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function isGenericPhrase(text: string): boolean {
  const norm = normalizedForSearch(text);
  if (GENERIC_PHRASES.has(norm)) return true;
  // Exact short liturgical calls
  if (norm.length < 24 && /^(amen|hallelujah|praise (the )?lord|thank you( lord| jesus)?)$/.test(norm)) {
    return true;
  }
  return false;
}

export function meetsQuotationLength(
  text: string,
  settings: QuotationSettings = DEFAULT_QUOTATION_SETTINGS,
): boolean {
  const trimmed = text.trim();
  if (trimmed.length < settings.minChars) return false;
  if (significantTokens(trimmed).length < settings.minSignificantWords) return false;
  if (isGenericPhrase(trimmed)) return false;
  return true;
}

/** Build a safe FTS5 MATCH query from significant tokens (AND of quoted tokens). */
export function buildFtsQuery(text: string, maxTokens = 12): string | null {
  const tokens = significantTokens(text).slice(0, maxTokens);
  if (tokens.length < 3) return null;
  // Quote each token to avoid FTS operators; escape internal quotes
  return tokens.map((t) => `"${t.replace(/"/g, "")}"`).join(" ");
}

export interface QuotationCandidate {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  originalText: string;
  normalizedText: string;
  translationId: string;
  /** Lexical confidence 0–1 (typically suggestion-range unless near-exact). */
  confidence: number;
  /** Overlap ratio significant tokens. */
  overlap: number;
  rawMatch: string;
  ftsRank: number;
}

export interface QuotationSearchHit {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  originalText: string;
  normalizedText: string;
  rank: number;
}

/**
 * Rank FTS hits by token overlap + exact-substring bonus.
 * Near-exact quotations can exceed auto-live threshold; typical hits stay as suggestions.
 */
export function rankQuotationCandidates(
  phrase: string,
  hits: QuotationSearchHit[],
): QuotationCandidate[] {
  const queryTokens = significantTokens(phrase);
  if (queryTokens.length === 0) return [];
  const querySet = new Set(queryTokens);
  const phraseNorm = normalizedForSearch(phrase);

  const ranked: QuotationCandidate[] = [];

  for (const hit of hits) {
    const verseTokens = significantTokens(hit.normalizedText);
    if (verseTokens.length === 0) continue;
    const verseSet = new Set(verseTokens);
    let overlapCount = 0;
    for (const t of querySet) {
      if (verseSet.has(t)) overlapCount += 1;
    }
    const overlap = overlapCount / querySet.size;
    if (overlap < 0.45) continue;

    const verseNorm = normalizedForSearch(hit.normalizedText);
    const exact =
      verseNorm.includes(phraseNorm) ||
      phraseNorm.includes(verseNorm) ||
      longestCommonTokenRun(queryTokens, verseTokens) >= Math.min(8, queryTokens.length);

    // bm25: lower is better; map loosely into 0–0.15 boost
    const rankBoost = Math.max(0, Math.min(0.15, 0.15 - (hit.rank + 5) / 40));

    let confidence = 0.35 + overlap * 0.4 + rankBoost;
    if (exact) confidence = Math.max(confidence, 0.88 + Math.min(0.1, overlap * 0.1));
    if (overlap >= 0.85 && queryTokens.length >= 8) {
      confidence = Math.max(confidence, 0.82);
    }
    confidence = Math.max(0.3, Math.min(0.97, Number(confidence.toFixed(3))));

    ranked.push({
      bookId: hit.bookId,
      bookName: hit.bookName,
      chapter: hit.chapter,
      verse: hit.verse,
      originalText: hit.originalText,
      normalizedText: hit.normalizedText,
      translationId: hit.translationId,
      confidence,
      overlap,
      rawMatch: phrase.slice(0, 160),
      ftsRank: hit.rank,
    });
  }

  ranked.sort((a, b) => b.confidence - a.confidence || a.ftsRank - b.ftsRank);
  return ranked;
}

function longestCommonTokenRun(a: string[], b: string[]): number {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k += 1;
      if (k > best) best = k;
    }
  }
  return best;
}
