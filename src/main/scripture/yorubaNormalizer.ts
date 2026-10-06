/**
 * Yoruba / general Unicode normalizer for *matching only*.
 * Display text must keep original diacritics and casing from the Bible DB.
 */

/** Explicit Yoruba letters → ASCII before NFKD (belt-and-suspenders). */
const YORUBA_LETTER_FOLD: Record<string, string> = {
  ẹ: "e",
  Ẹ: "E",
  ọ: "o",
  Ọ: "O",
  ṣ: "s",
  Ṣ: "S",
};

export function stripDiacritics(text: string): string {
  let out = "";
  for (const ch of text) {
    out += YORUBA_LETTER_FOLD[ch] ?? ch;
  }
  return out.normalize("NFKD").replace(/\p{M}/gu, "");
}

/**
 * Normalize for alias / number matching.
 * Strips diacritics, folds case, collapses punctuation noise, removes ZW* chars.
 */
export function normalizeForMatch(text: string): string {
  return stripDiacritics(text)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/['’`´]/g, "'")
    .replace(/[^\p{L}\p{N}\s:'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Alias of normalizeForMatch kept for brief naming. */
export function yorubaNormalize(text: string): string {
  return normalizeForMatch(text);
}

/**
 * Soft ASR cleanup applied only when expanding alias candidates —
 * does not rewrite display text. Safe folds only.
 */
export function asrFoldForMatch(normalized: string): string {
  return normalized
    .replace(/\byohanu\b/g, "johanu")
    .replace(/\bjohano\b/g, "johanu")
    .replace(/\bmatiyu\b/g, "matiu")
    .replace(/\bmathew\b/g, "matiu")
    .replace(/\bifihan\b/g, "ifihan");
}
