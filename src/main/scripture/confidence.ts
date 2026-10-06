export type DetectionMethod = "direct" | "contextual" | "quotation" | "semantic" | "manual";

export interface ConfidenceInput {
  method: DetectionMethod;
  /** Alias match quality 0–1 */
  aliasScore?: number;
  /** Context freshness 0–1 */
  contextStrength?: number;
  /** Explicit chapter:verse punctuation present */
  hasExplicitPunctuation?: boolean;
  /** Spoken form (chapter/verse words) vs compact */
  isSpokenForm?: boolean;
  /** Range present */
  hasRange?: boolean;
  /** DB validated */
  dbValidated?: boolean;
}

/**
 * Deterministic confidence scoring — no LLM.
 * Direct explicit refs score highest; contextual depends on freshness.
 */
export function scoreConfidence(input: ConfidenceInput): number {
  let score = 0.5;

  switch (input.method) {
    case "direct":
      score = 0.82;
      break;
    case "contextual":
      score = 0.55 + 0.25 * (input.contextStrength ?? 0);
      break;
    case "manual":
      score = 1;
      break;
    case "quotation":
      score = 0.45;
      break;
    case "semantic":
      score = 0.35;
      break;
    default:
      score = 0.4;
  }

  if (input.aliasScore != null) {
    score = score * (0.7 + 0.3 * input.aliasScore);
  }
  if (input.hasExplicitPunctuation) score += 0.08;
  if (input.isSpokenForm) score -= 0.03;
  if (input.hasRange) score -= 0.02;
  if (input.dbValidated) score += 0.05;

  return Math.max(0, Math.min(0.99, Number(score.toFixed(3))));
}
