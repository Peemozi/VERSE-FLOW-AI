import fs from "node:fs";
import path from "node:path";
import { CANONICAL_BOOKS, type CanonicalBookId } from "../../shared/scripture/books";
import { normalizeForMatch } from "./yorubaNormalizer";

export type AliasLanguage = "en" | "yo";

export interface BookAliasHit {
  bookId: CanonicalBookId;
  alias: string;
  language: AliasLanguage;
  /** Character span in the *normalized* haystack. */
  start: number;
  end: number;
}

type AliasEntry = { bookId: CanonicalBookId; alias: string; language: AliasLanguage; norm: string };

let aliasTable: AliasEntry[] | null = null;

function readAliasFile(filePath: string): Record<string, string[]> {
  if (!fs.existsSync(filePath)) return {};
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const [bookId, aliases] of Object.entries(raw)) {
    if (bookId.startsWith("_")) continue;
    if (Array.isArray(aliases)) {
      out[bookId] = aliases.filter((a): a is string => typeof a === "string");
    }
  }
  return out;
}

function resourcePaths(filename: string): string[] {
  return [
    path.join(process.cwd(), "resources", "aliases", filename),
    path.join(__dirname, "../../../resources/aliases", filename),
  ];
}

function loadAliasFile(filename: string): Record<string, string[]> {
  for (const p of resourcePaths(filename)) {
    const data = readAliasFile(p);
    if (Object.keys(data).length > 0) return data;
  }
  return {};
}

function buildAliasTable(): AliasEntry[] {
  const en = loadAliasFile("book-aliases.en.json");
  const yo = loadAliasFile("book-aliases.yo.json");
  const entries: AliasEntry[] = [];

  for (const book of CANONICAL_BOOKS) {
    const add = (alias: string, language: AliasLanguage) => {
      const norm = normalizeForMatch(alias);
      if (!norm) return;
      entries.push({ bookId: book.id, alias, language, norm });
    };
    add(book.nameEn, "en");
    add(book.id, "en");
    for (const a of en[book.id] ?? []) add(a, "en");
    for (const a of yo[book.id] ?? []) add(a, "yo");
  }

  // Longest alias first for greedy matching
  entries.sort((a, b) => b.norm.length - a.norm.length);
  return entries;
}

export function getAliasTable(): AliasEntry[] {
  if (!aliasTable) aliasTable = buildAliasTable();
  return aliasTable;
}

/** Test helper — reset / inject. */
export function resetAliasTableForTests(): void {
  aliasTable = null;
}

export function setAliasTableForTests(entries: AliasEntry[]): void {
  aliasTable = [...entries].sort((a, b) => b.norm.length - a.norm.length);
}

export function resolveBookAlias(
  token: string,
  languages: AliasLanguage[] = ["en", "yo"],
): { bookId: CanonicalBookId; alias: string; language: AliasLanguage } | null {
  const norm = normalizeForMatch(token);
  if (!norm) return null;
  const langSet = new Set(languages);
  for (const entry of getAliasTable()) {
    if (!langSet.has(entry.language) && entry.language !== "en") {
      // Always allow EN canonical names; filter YO if not requested
    }
    if (!langSet.has(entry.language)) continue;
    if (entry.norm === norm) {
      return { bookId: entry.bookId, alias: entry.alias, language: entry.language };
    }
  }
  return null;
}

/**
 * Find book-name aliases inside normalized text (non-overlapping, longest first).
 */
export function findBookAliasesInText(
  normalizedText: string,
  languages: AliasLanguage[] = ["en", "yo"],
): BookAliasHit[] {
  const langSet = new Set(languages);
  const hits: BookAliasHit[] = [];
  const occupied: boolean[] = Array.from({ length: normalizedText.length }, () => false);

  for (const entry of getAliasTable()) {
    if (!langSet.has(entry.language)) continue;
    const needle = entry.norm;
    let from = 0;
    while (from < normalizedText.length) {
      const idx = normalizedText.indexOf(needle, from);
      if (idx < 0) break;
      const end = idx + needle.length;
      const beforeOk = idx === 0 || !/[a-z0-9]/.test(normalizedText[idx - 1] ?? "");
      const afterOk = end >= normalizedText.length || !/[a-z0-9]/.test(normalizedText[end] ?? "");
      const overlaps = occupied.slice(idx, end).some(Boolean);
      if (beforeOk && afterOk && !overlaps) {
        hits.push({
          bookId: entry.bookId,
          alias: entry.alias,
          language: entry.language,
          start: idx,
          end,
        });
        for (let i = idx; i < end; i++) occupied[i] = true;
      }
      from = idx + 1;
    }
  }

  return hits.sort((a, b) => a.start - b.start);
}
