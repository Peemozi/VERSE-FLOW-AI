import { normalizeForMatch } from "./yorubaNormalizer";

/**
 * Transcript normalizer — prepares STT / simulation text for the detection pipeline.
 * Does not alter meaning; collapses noise that blocks deterministic parsing.
 */
export function normalizeTranscript(text: string): string {
  return normalizeForMatch(text)
    .replace(/\bverse\b/g, "verse")
    .replace(/\bversus\b/g, "verse")
    .replace(/\bv\b(?=\s*\d)/g, "verse")
    // Yoruba verse / chapter keywords (diacritics already stripped)
    .replace(/\bese\b/g, "verse")
    .replace(/\beses\b/g, "verse")
    .replace(/\bori\b/g, "chapter")
    .replace(/\bipin\b/g, "chapter")
    .replace(/\bchapter\b/g, "chapter")
    .replace(/\bchapters\b/g, "chapter")
    .replace(/\bch\b(?=\s*\d)/g, "chapter")
    .replace(/\bthru\b/g, "through")
    .replace(/\bto\b(?=\s*(?:verse|chapter|\d))/g, "to")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
