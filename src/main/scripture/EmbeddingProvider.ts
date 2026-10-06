/**
 * Optional embedding backend for semantic verse matching.
 * Core detection never depends on a real model — use NoOp until one is bundled.
 */
export interface EmbeddingProvider {
  readonly id: string;
  /** False until a model/API is configured. */
  readonly available: boolean;
  /** Human-readable note for settings / docs. */
  readonly displayName: string;
  dimensions(): number;
  /**
   * Embed one or more texts. Returns [] when unavailable.
   * Implementations must not throw into callers — return empty or reject softly.
   */
  embed(texts: string[]): Promise<number[][]>;
}

/** Default provider — no model bundled; semantic path is a no-op. */
export class NoOpEmbeddingProvider implements EmbeddingProvider {
  readonly id = "noop";
  readonly available = false;
  readonly displayName = "No embedding model (stub)";

  dimensions(): number {
    return 0;
  }

  async embed(_texts: string[]): Promise<number[][]> {
    return [];
  }
}

/**
 * Factory — swap in a real provider later (local ONNX / remote API)
 * without changing ScriptureDetector.
 */
export function createEmbeddingProvider(): EmbeddingProvider {
  // Future: if VERSEFLOW_EMBEDDING_MODEL or bundled resources/models/* exists, load it.
  return new NoOpEmbeddingProvider();
}

/** Cosine similarity for unit testing / future providers. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
