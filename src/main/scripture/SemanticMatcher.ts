import type { BibleVerseDto } from "../../shared/schemas";
import {
  cosineSimilarity,
  type EmbeddingProvider,
  NoOpEmbeddingProvider,
} from "./EmbeddingProvider";
import {
  createReferenceInterpretationProvider,
  validateInterpretedReferences,
  type ReferenceInterpretationProvider,
} from "./ReferenceInterpretationProvider";

export interface SemanticCandidate {
  bookId: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  confidence: number;
  referenceLabel: string;
  verseText: string | null;
  translationId: string;
  rawMatch: string;
  source: "embedding" | "llm-interpret";
}

export interface SemanticMatcherOptions {
  embedding: EmbeddingProvider;
  interpreter?: ReferenceInterpretationProvider;
  enabled: boolean;
  /** Minimum cosine / confidence to surface (default 0.82). */
  minConfidence?: number;
  translationId: string;
  /**
   * Optional corpus for embedding search. Empty = embedding path returns nothing
   * (expected until a model + precomputed index ship).
   */
  corpus?: Array<{
    bookId: string;
    chapter: number;
    verse: number;
    text: string;
    embedding?: number[];
    referenceLabel: string;
  }>;
  verseExists?: (bookId: string, chapter: number, verse: number) => boolean;
  getVerse?: (
    translationId: string,
    bookId: string,
    chapter: number,
    verse: number,
  ) => BibleVerseDto | null;
}

/**
 * Optional semantic / LLM suggestion path.
 * Always invoked asynchronously — never await inside the direct detection hot path.
 */
export class SemanticMatcher {
  private embedding: EmbeddingProvider;
  private interpreter: ReferenceInterpretationProvider;
  private enabled: boolean;
  private minConfidence: number;
  private translationId: string;
  private corpus: NonNullable<SemanticMatcherOptions["corpus"]>;
  private verseExists?: SemanticMatcherOptions["verseExists"];
  private getVerse?: SemanticMatcherOptions["getVerse"];
  private generation = 0;

  constructor(options: SemanticMatcherOptions) {
    this.embedding = options.embedding;
    this.interpreter = options.interpreter ?? createReferenceInterpretationProvider();
    this.enabled = options.enabled;
    this.minConfidence = options.minConfidence ?? 0.82;
    this.translationId = options.translationId;
    this.corpus = options.corpus ?? [];
    this.verseExists = options.verseExists;
    this.getVerse = options.getVerse;
  }

  updateConfig(partial: {
    enabled?: boolean;
    minConfidence?: number;
    translationId?: string;
  }): void {
    if (partial.enabled != null) this.enabled = partial.enabled;
    if (partial.minConfidence != null) this.minConfidence = partial.minConfidence;
    if (partial.translationId != null) this.translationId = partial.translationId;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  providerStatus(): { embedding: boolean; interpreter: boolean } {
    return {
      embedding: this.embedding.available,
      interpreter: this.interpreter.available,
    };
  }

  /**
   * Fire-and-forget semantic search. Invokes `onResult` later with suggestions.
   * Safe when disabled / no-op providers — resolves to [] without work.
   */
  schedule(
    transcript: string,
    excludeKeys: Set<string>,
    onResult: (candidates: SemanticCandidate[]) => void,
  ): void {
    if (!this.enabled) {
      queueMicrotask(() => onResult([]));
      return;
    }
    const gen = ++this.generation;
    void this.run(transcript, excludeKeys)
      .then((cands) => {
        if (gen !== this.generation) return; // superseded
        onResult(cands);
      })
      .catch(() => {
        if (gen === this.generation) onResult([]);
      });
  }

  /** Testable async entry — prefer `schedule` from production hot paths. */
  async run(transcript: string, excludeKeys: Set<string> = new Set()): Promise<SemanticCandidate[]> {
    if (!this.enabled) return [];
    const text = transcript.trim();
    if (text.length < 24) return [];

    const out: SemanticCandidate[] = [];

    if (this.embedding.available && this.corpus.length > 0) {
      try {
        const [queryVec] = await this.embedding.embed([text]);
        if (queryVec && queryVec.length > 0) {
          for (const row of this.corpus) {
            const key = `${row.bookId}:${row.chapter}:${row.verse}`;
            if (excludeKeys.has(key)) continue;
            let emb: number[] = row.embedding ?? [];
            if (emb.length === 0) {
              const embedded = await this.embedding.embed([row.text]);
              emb = embedded[0] ?? [];
            }
            if (emb.length === 0) continue;
            const sim = cosineSimilarity(queryVec, emb);
            if (sim < this.minConfidence) continue;
            out.push({
              bookId: row.bookId,
              chapter: row.chapter,
              verse: row.verse,
              confidence: Number(sim.toFixed(3)),
              referenceLabel: row.referenceLabel,
              verseText: row.text,
              translationId: this.translationId,
              rawMatch: text.slice(0, 120),
              source: "embedding",
            });
          }
        }
      } catch {
        /* never break callers */
      }
    }

    if (this.interpreter.available && this.verseExists) {
      try {
        const raw = await this.interpreter.interpret(text);
        const validated = validateInterpretedReferences(raw, this.verseExists);
        for (const r of validated) {
          const key = `${r.bookId}:${r.chapter}:${r.verse}`;
          if (excludeKeys.has(key)) continue;
          if (r.confidence < this.minConfidence) continue;
          const verse = this.getVerse?.(this.translationId, r.bookId, r.chapter, r.verse);
          out.push({
            bookId: r.bookId,
            chapter: r.chapter,
            verse: r.verse,
            endVerse: r.endVerse,
            confidence: Math.min(0.95, r.confidence),
            referenceLabel: verse?.referenceLabel ?? `${r.bookId} ${r.chapter}:${r.verse}`,
            verseText: verse?.originalText ?? null,
            translationId: this.translationId,
            rawMatch: text.slice(0, 120),
            source: "llm-interpret",
          });
        }
      } catch {
        /* never break callers */
      }
    }

    out.sort((a, b) => b.confidence - a.confidence);
    return out.slice(0, 5);
  }
}

/** Convenience for tests / disabled default. */
export function createDisabledSemanticMatcher(
  translationId = "WEB",
): SemanticMatcher {
  return new SemanticMatcher({
    embedding: new NoOpEmbeddingProvider(),
    enabled: false,
    translationId,
  });
}
