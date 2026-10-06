import { CANONICAL_BOOKS, type CanonicalBookId } from "../../shared/scripture/books";
import type { BibleVerseDto } from "../../shared/schemas";
import type { AliasLanguage } from "./bookAliasEngine";
import { scoreConfidence } from "./confidence";
import { ContextTracker } from "./contextTracker";
import { DuplicateSuppressor } from "./duplicateSuppressor";
import type { NumberLanguage } from "./numberNormalizer";
import { formatReferenceLabel, parseReferences, type RawMatch } from "./referenceParser";
import { normalizeTranscript } from "./transcriptNormalizer";
import { digitizeSpokenNumbers } from "./numberNormalizer";
import { validateAgainstDb } from "./referenceValidator";
import { QuotationDetector } from "./QuotationDetector";
import type { QuotationSettings } from "./quotationMatcher";
import type { SemanticCandidate, SemanticMatcher } from "./SemanticMatcher";

export interface DetectionEvent {
  id: string;
  method: RawMatch["method"];
  bookId: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  confidence: number;
  transcriptSnippet: string;
  rawMatch: string;
  referenceLabel: string;
  translationId: string;
  verseText: string | null;
  suppressed: boolean;
  createdAt: string;
  /** Quotation (and future semantic) suggestions until high-confidence auto-live. */
  isSuggestion?: boolean;
}

export interface PipelineProcessResult {
  detections: DetectionEvent[];
  suppressed: DetectionEvent[];
  context: ReturnType<ContextTracker["snapshot"]>;
  normalizedTranscript: string;
}

export interface ScriptureDetectorOptions {
  translationId?: string;
  languages?: AliasLanguage[];
  numberLanguage?: NumberLanguage;
  contextTtlMs?: number;
  duplicateWindowMs?: number;
  verseExists?: (bookId: string, chapter: number, verse: number) => boolean;
  getVerse?: (
    translationId: string,
    bookId: string,
    chapter: number,
    verse: number,
  ) => BibleVerseDto | null;
  /** Optional quotation detector — when omitted, quotation path is skipped. */
  quotationDetector?: QuotationDetector | null;
  quotationSettings?: Partial<QuotationSettings>;
  /** Optional semantic matcher — scheduled async only; never awaited in processTranscript. */
  semanticMatcher?: SemanticMatcher | null;
}

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `det_${Date.now()}_${idSeq}`;
}

const bookName = new Map(CANONICAL_BOOKS.map((b) => [b.id, b.nameEn]));

/**
 * Direct + contextual scripture detector, then optional quotation (FTS) suggestions.
 * Quotation runs *after* the direct path so reference detection stays instant.
 */
export class ScriptureDetector {
  private readonly context: ContextTracker;
  private readonly duplicates: DuplicateSuppressor;
  private translationId: string;
  private languages: AliasLanguage[];
  private numberLanguage: NumberLanguage;
  private verseExists?: ScriptureDetectorOptions["verseExists"];
  private getVerseFn?: ScriptureDetectorOptions["getVerse"];
  private quotationDetector: QuotationDetector | null;
  private semanticMatcher: SemanticMatcher | null;

  constructor(options: ScriptureDetectorOptions = {}) {
    this.context = new ContextTracker({ ttlMs: options.contextTtlMs });
    this.duplicates = new DuplicateSuppressor({ windowMs: options.duplicateWindowMs });
    this.translationId = options.translationId ?? "WEB";
    this.languages = options.languages ?? ["en", "yo"];
    this.numberLanguage = options.numberLanguage ?? "auto";
    this.verseExists = options.verseExists;
    this.getVerseFn = options.getVerse;
    this.quotationDetector = options.quotationDetector ?? null;
    this.semanticMatcher = options.semanticMatcher ?? null;
    if (this.quotationDetector && options.quotationSettings) {
      this.quotationDetector.updateSettings(options.quotationSettings);
    }
  }

  reset(): void {
    this.context.reset();
    this.duplicates.reset();
    this.quotationDetector?.reset();
  }

  setTranslationId(id: string): void {
    this.translationId = id;
    this.quotationDetector?.setTranslationId(id);
    this.semanticMatcher?.updateConfig({ translationId: id });
  }

  setLanguages(languages: AliasLanguage[]): void {
    this.languages = languages;
  }

  setQuotationDetector(detector: QuotationDetector | null): void {
    this.quotationDetector = detector;
  }

  setSemanticMatcher(matcher: SemanticMatcher | null): void {
    this.semanticMatcher = matcher;
  }

  updateQuotationSettings(partial: Partial<QuotationSettings>): void {
    this.quotationDetector?.updateSettings(partial);
  }

  updateSemanticConfig(partial: { enabled?: boolean; minConfidence?: number }): void {
    this.semanticMatcher?.updateConfig(partial);
  }

  /**
   * Schedule optional semantic suggestions. Never blocks; safe when disabled/stub.
   * Callers (live STT / simulation) may push results to the UI asynchronously.
   */
  scheduleSemanticSuggestions(
    transcript: string,
    excludeFromResult: PipelineProcessResult,
    onResult: (events: DetectionEvent[]) => void,
  ): void {
    if (!this.semanticMatcher?.isEnabled()) return;
    const exclude = new Set(
      excludeFromResult.detections.map((d) => `${d.bookId}:${d.chapter}:${d.verse}`),
    );
    this.semanticMatcher.schedule(transcript, exclude, (cands) => {
      onResult(cands.map((c) => this.semanticCandidateToEvent(c, transcript)));
    });
  }

  private semanticCandidateToEvent(c: SemanticCandidate, transcript: string): DetectionEvent {
    return {
      id: nextId(),
      method: "semantic",
      bookId: c.bookId,
      chapter: c.chapter,
      verse: c.verse,
      endVerse: c.endVerse,
      confidence: c.confidence,
      transcriptSnippet: transcript.trim(),
      rawMatch: c.rawMatch,
      referenceLabel: c.referenceLabel,
      translationId: c.translationId || this.translationId,
      verseText: c.verseText,
      suppressed: false,
      createdAt: new Date().toISOString(),
      isSuggestion: true,
    };
  }

  processTranscript(transcript: string, now = Date.now()): PipelineProcessResult {
    // —— Fast path: direct + contextual (must stay instant; no FTS here) ——
    const normalizedTranscript = digitizeSpokenNumbers(
      normalizeTranscript(transcript),
      this.numberLanguage,
    );
    const ctx = this.context.get(now);
    const strength = this.context.strength(now);
    const matches = parseReferences(transcript, {
      languages: this.languages,
      numberLanguage: this.numberLanguage,
      context: ctx,
      contextStrength: strength,
    });

    const candidates: DetectionEvent[] = [];
    const directKeys = new Set<string>();

    for (const match of matches) {
      let confidence = match.confidence;
      let verseText: string | null = null;

      if (this.verseExists) {
        const db = validateAgainstDb(match, this.verseExists);
        if (!db.ok) continue;
        confidence = scoreConfidence({
          method: match.method,
          hasExplicitPunctuation: match.hasExplicitPunctuation,
          isSpokenForm: match.isSpokenForm,
          hasRange: match.endVerse != null,
          dbValidated: true,
          contextStrength: match.method === "contextual" ? strength : undefined,
        });
      }

      if (this.getVerseFn) {
        const v = this.getVerseFn(this.translationId, match.bookId, match.chapter, match.verse);
        verseText = v?.originalText ?? null;
      }

      const key = `${match.bookId}:${match.chapter}:${match.verse}`;
      directKeys.add(key);

      candidates.push({
        id: nextId(),
        method: match.method,
        bookId: match.bookId,
        chapter: match.chapter,
        verse: match.verse,
        endVerse: match.endVerse,
        confidence,
        transcriptSnippet: transcript.trim(),
        rawMatch: match.rawMatch,
        referenceLabel: formatReferenceLabel(
          match,
          bookName.get(match.bookId) ?? match.bookId,
        ),
        translationId: this.translationId,
        verseText,
        suppressed: false,
        createdAt: new Date(now).toISOString(),
        isSuggestion: false,
      });
    }

    // —— Quotation path (after direct; never blocks reference parsing) ——
    if (this.quotationDetector) {
      try {
        const quotes = this.quotationDetector.detect(transcript);
        for (const q of quotes) {
          const key = `${q.bookId}:${q.chapter}:${q.verse}`;
          if (directKeys.has(key)) continue;
          if (this.verseExists) {
            const ok = this.verseExists(q.bookId, q.chapter, q.verse);
            if (!ok) continue;
          }
          candidates.push({
            id: nextId(),
            method: "quotation",
            bookId: q.bookId,
            chapter: q.chapter,
            verse: q.verse,
            confidence: q.confidence,
            transcriptSnippet: transcript.trim(),
            rawMatch: q.rawMatch,
            referenceLabel: `${q.bookName} ${q.chapter}:${q.verse}`,
            translationId: q.translationId || this.translationId,
            verseText: q.originalText,
            suppressed: false,
            createdAt: new Date(now).toISOString(),
            isSuggestion: true,
          });
        }
      } catch {
        // Quotation must never break the direct pipeline
      }
    }

    const suppressInput = candidates.map((e) => ({
      bookId: e.bookId as CanonicalBookId,
      chapter: e.chapter,
      verse: e.verse,
      endVerse: e.endVerse,
      method: e.method,
      confidence: e.confidence,
      event: e,
    }));

    const { kept, suppressed } = this.duplicates.filter(suppressInput, now);

    for (const item of kept) {
      if (item.method === "quotation") continue;
      this.context.update(
        {
          bookId: item.bookId,
          chapter: item.chapter,
          verse: item.verse,
        },
        now,
      );
    }

    // Prefer direct/contextual ahead of quotation suggestions in the operator list
    const detections = kept
      .map((k) => k.event)
      .sort((a, b) => {
        const rank = (m: string) => (m === "quotation" ? 1 : 0);
        if (rank(a.method) !== rank(b.method)) return rank(a.method) - rank(b.method);
        return b.confidence - a.confidence;
      });

    return {
      detections,
      suppressed: suppressed.map((s) => ({ ...s.event, suppressed: true })),
      context: this.context.snapshot(),
      normalizedTranscript,
    };
  }
}
