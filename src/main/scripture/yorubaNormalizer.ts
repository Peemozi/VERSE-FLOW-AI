/**
 * Yoruba / general Unicode normalizer for *matching only*.
 * Display text must keep original diacritics and casing from the Bible DB.
 */
export function stripDiacritics(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "");
}

export function normalizeForMatch(text: string): string {
  return stripDiacritics(text)
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
