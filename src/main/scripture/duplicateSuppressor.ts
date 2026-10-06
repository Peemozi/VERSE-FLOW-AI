import type { CanonicalBookId } from "../../shared/scripture/books";
import type { DetectionMethod } from "./confidence";

export interface SuppressibleDetection {
  bookId: CanonicalBookId;
  chapter: number;
  verse: number;
  endVerse?: number;
  method: DetectionMethod;
  confidence: number;
}

export interface DuplicateSuppressorOptions {
  /** Default 45s */
  windowMs?: number;
}

function keyOf(d: SuppressibleDetection): string {
  return `${d.bookId}:${d.chapter}:${d.verse}:${d.endVerse ?? d.verse}`;
}

/**
 * Suppress identical references repeated within a short window
 * (same speaker re-reading a verse).
 */
export class DuplicateSuppressor {
  private readonly seen = new Map<string, number>();

  constructor(private readonly options: DuplicateSuppressorOptions = {}) {}

  private window(): number {
    return this.options.windowMs ?? 45_000;
  }

  reset(): void {
    this.seen.clear();
  }

  /**
   * Returns detections that should be emitted; duplicates are filtered out.
   */
  filter<T extends SuppressibleDetection>(
    detections: T[],
    now = Date.now(),
  ): { kept: T[]; suppressed: T[] } {
    const kept: T[] = [];
    const suppressed: T[] = [];
    const window = this.window();

    // Drop expired keys
    for (const [k, ts] of this.seen) {
      if (now - ts > window) this.seen.delete(k);
    }

    for (const d of detections) {
      const k = keyOf(d);
      const prev = this.seen.get(k);
      if (prev != null && now - prev <= window) {
        suppressed.push(d);
        continue;
      }
      this.seen.set(k, now);
      kept.push(d);
    }

    return { kept, suppressed };
  }
}
