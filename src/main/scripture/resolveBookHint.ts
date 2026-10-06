import type { CanonicalBookId } from "../../shared/scripture/books";
import {
  aliasConfidenceBoost,
  findBookAliasesInText,
  type AliasLanguage,
  type AliasSource,
} from "./bookAliasEngine";

export function resolveBookHint(
  bookHint: string,
  languages: AliasLanguage[],
): {
  bookId: CanonicalBookId;
  language: AliasLanguage;
  aliasScore: number;
  alias: string;
  source: AliasSource;
} | null {
  const hint = bookHint.trim().replace(/\./g, "");
  if (!hint) return null;

  // Prefer trailing slices ("the book of john" → "john")
  const parts = hint.split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const slice = parts.slice(i).join(" ");
    const hits = findBookAliasesInText(slice, languages);
    if (hits.length === 0) continue;
    const best = hits.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
    const coverage = (best.end - best.start) / Math.max(slice.length, 1);
    if (coverage >= 0.6 || slice.length <= best.end - best.start + 1) {
      return {
        bookId: best.bookId,
        language: best.language,
        alias: best.alias,
        source: best.source,
        aliasScore: Math.min(1, Math.max(0.55, coverage)) * aliasConfidenceBoost(best.source),
      };
    }
  }

  const hits = findBookAliasesInText(hint, languages);
  if (hits.length === 0) return null;
  const best = hits[0]!;
  return {
    bookId: best.bookId,
    language: best.language,
    alias: best.alias,
    source: best.source,
    aliasScore: 0.7 * aliasConfidenceBoost(best.source),
  };
}
