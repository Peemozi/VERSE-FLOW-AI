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
}

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `det_${Date.now()}_${idSeq}`;
}

const bookName = new Map(CANONICAL_BOOKS.map((b) => [b.id, b.nameEn]));

/**
 * Direct + contextual scripture detector.
 * Simulation Mode and future live STT share this entrypoint.
 */
export class ScriptureDetector {
  private readonly context: ContextTracker;
  private readonly duplicates: DuplicateSuppressor;
  private translationId: string;
  private languages: AliasLanguage[];
  private numberLanguage: NumberLanguage;
  private verseExists?: ScriptureDetectorOptions["verseExists"];
  private getVerseFn?: ScriptureDetectorOptions["getVerse"];

  constructor(options: ScriptureDetectorOptions = {}) {
    this.context = new ContextTracker({ ttlMs: options.contextTtlMs });
    this.duplicates = new DuplicateSuppressor({ windowMs: options.duplicateWindowMs });
    this.translationId = options.translationId ?? "WEB";
    this.languages = options.languages ?? ["en", "yo"];
    this.numberLanguage = options.numberLanguage ?? "auto";
    this.verseExists = options.verseExists;
    this.getVerseFn = options.getVerse;
  }

  reset(): void {
    this.context.reset();
    this.duplicates.reset();
  }

  setTranslationId(id: string): void {
    this.translationId = id;
  }

  setLanguages(languages: AliasLanguage[]): void {
    this.languages = languages;
  }

  processTranscript(transcript: string, now = Date.now()): PipelineProcessResult {
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
      });
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
      this.context.update(
        {
          bookId: item.bookId,
          chapter: item.chapter,
          verse: item.verse,
        },
        now,
      );
    }

    return {
      detections: kept.map((k) => k.event),
      suppressed: suppressed.map((s) => ({ ...s.event, suppressed: true })),
      context: this.context.snapshot(),
      normalizedTranscript,
    };
  }
}
