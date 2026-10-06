import type { BibleRepository } from "../database/BibleRepository";
import {
  DEFAULT_QUOTATION_SETTINGS,
  TranscriptSentenceBuffer,
  buildFtsQuery,
  meetsQuotationLength,
  rankQuotationCandidates,
  type QuotationCandidate,
  type QuotationSettings,
} from "./quotationMatcher";

export interface QuotationDetectorOptions {
  repo: BibleRepository;
  translationId: string;
  settings?: Partial<QuotationSettings>;
}

/**
 * Lexical quotation detection via FTS5.
 * Always invoked *after* direct/contextual parsing so it never blocks the fast path.
 */
export class QuotationDetector {
  private readonly buffer = new TranscriptSentenceBuffer();
  private settings: QuotationSettings;
  private translationId: string;
  private readonly repo: BibleRepository;

  constructor(options: QuotationDetectorOptions) {
    this.repo = options.repo;
    this.translationId = options.translationId;
    this.settings = { ...DEFAULT_QUOTATION_SETTINGS, ...options.settings };
  }

  reset(): void {
    this.buffer.reset();
  }

  setTranslationId(id: string): void {
    this.translationId = id;
  }

  updateSettings(partial: Partial<QuotationSettings>): void {
    this.settings = { ...this.settings, ...partial };
  }

  /**
   * Find quotation candidates for a transcript chunk.
   * Returns [] quickly when disabled / too short / generic / no FTS hits.
   */
  detect(transcript: string): QuotationCandidate[] {
    if (!this.settings.enabled) return [];

    const windows = this.buffer.push(transcript);
    const results: QuotationCandidate[] = [];
    const seen = new Set<string>();

    for (const window of windows) {
      if (!meetsQuotationLength(window, this.settings)) continue;
      const ftsQuery = buildFtsQuery(window);
      if (!ftsQuery) continue;

      const hits = this.repo.searchQuotation(
        this.translationId,
        ftsQuery,
        this.settings.maxCandidates,
      );
      const ranked = rankQuotationCandidates(window, hits);
      for (const c of ranked) {
        const key = `${c.bookId}:${c.chapter}:${c.verse}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(c);
      }
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, 5);
  }
}
