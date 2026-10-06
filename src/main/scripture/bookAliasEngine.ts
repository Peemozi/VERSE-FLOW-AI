import fs from "node:fs";
import path from "node:path";
import { CANONICAL_BOOKS, type CanonicalBookId } from "../../shared/scripture/books";
import { asrFoldForMatch, normalizeForMatch } from "./yorubaNormalizer";
import { getResourcesRoot } from "../paths";

export type AliasLanguage = "en" | "yo";
export type AliasSource = "verified" | "uncertain" | "asr" | "canonical";

export interface BookAliasHit {
  bookId: CanonicalBookId;
  alias: string;
  language: AliasLanguage;
  source: AliasSource;
  /** Character span in the *normalized* haystack. */
  start: number;
  end: number;
}

type AliasEntry = {
  bookId: CanonicalBookId;
  alias: string;
  language: AliasLanguage;
  source: AliasSource;
  norm: string;
};

let aliasTable: AliasEntry[] | null = null;

function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function aliasesFromValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((a): a is string => typeof a === "string");
  }
  return [];
}

function resourcePaths(filename: string): string[] {
  return [
    path.join(getResourcesRoot(), "aliases", filename),
    path.join(process.cwd(), "resources", "aliases", filename),
    path.join(__dirname, "../../../resources/aliases", filename),
  ];
}

function loadAliasFile(filename: string): {
  verified: Record<string, string[]>;
  uncertain: Record<string, string[]>;
  asr: Record<string, string[]>;
} {
  for (const p of resourcePaths(filename)) {
    const raw = readJson(p);
    if (Object.keys(raw).length === 0) continue;
    const verified: Record<string, string[]> = {};
    const uncertain: Record<string, string[]> = {};
    const asr: Record<string, string[]> = {};

    const uncertainBlock = (raw._uncertain as Record<string, unknown> | undefined) ?? {};
    const asrBlock = (raw._asr as Record<string, unknown> | undefined) ?? {};

    for (const [bookId, aliases] of Object.entries(uncertainBlock)) {
      if (bookId.startsWith("_")) continue;
      uncertain[bookId] = aliasesFromValue(aliases);
    }
    for (const [bookId, aliases] of Object.entries(asrBlock)) {
      if (bookId.startsWith("_")) continue;
      asr[bookId] = aliasesFromValue(aliases);
    }
    for (const [bookId, aliases] of Object.entries(raw)) {
      if (bookId.startsWith("_")) continue;
      verified[bookId] = aliasesFromValue(aliases);
    }
    return { verified, uncertain, asr };
  }
  return { verified: {}, uncertain: {}, asr: {} };
}

function buildAliasTable(): AliasEntry[] {
  const en = loadAliasFile("book-aliases.en.json");
  const yo = loadAliasFile("book-aliases.yo.json");
  const entries: AliasEntry[] = [];

  for (const book of CANONICAL_BOOKS) {
    const add = (alias: string, language: AliasLanguage, source: AliasSource) => {
      const norm = normalizeForMatch(alias);
      if (!norm) return;
      entries.push({ bookId: book.id, alias, language, source, norm });
      const folded = asrFoldForMatch(norm);
      if (folded !== norm) {
        entries.push({ bookId: book.id, alias, language, source, norm: folded });
      }
    };
    add(book.nameEn, "en", "canonical");
    add(book.id, "en", "canonical");
    for (const a of en.verified[book.id] ?? []) add(a, "en", "verified");
    for (const a of yo.verified[book.id] ?? []) add(a, "yo", "verified");
    for (const a of yo.uncertain[book.id] ?? []) add(a, "yo", "uncertain");
    for (const a of yo.asr[book.id] ?? []) add(a, "yo", "asr");
  }

  // Prefer longer aliases; within same length prefer verified > asr > uncertain
  const sourceRank: Record<AliasSource, number> = {
    verified: 3,
    canonical: 3,
    asr: 2,
    uncertain: 1,
  };
  entries.sort((a, b) => {
    if (b.norm.length !== a.norm.length) return b.norm.length - a.norm.length;
    return sourceRank[b.source] - sourceRank[a.source];
  });
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

export function aliasConfidenceBoost(source: AliasSource): number {
  switch (source) {
    case "verified":
    case "canonical":
      return 1;
    case "asr":
      return 0.85;
    case "uncertain":
      return 0.7;
    default:
      return 0.75;
  }
}

export function resolveBookAlias(
  token: string,
  languages: AliasLanguage[] = ["en", "yo"],
): {
  bookId: CanonicalBookId;
  alias: string;
  language: AliasLanguage;
  source: AliasSource;
} | null {
  const norm = normalizeForMatch(token);
  if (!norm) return null;
  const folded = asrFoldForMatch(norm);
  const langSet = new Set(languages);
  for (const entry of getAliasTable()) {
    if (!langSet.has(entry.language)) continue;
    if (entry.norm === norm || entry.norm === folded) {
      return {
        bookId: entry.bookId,
        alias: entry.alias,
        language: entry.language,
        source: entry.source,
      };
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
  const haystack = asrFoldForMatch(normalizedText);

  for (const entry of getAliasTable()) {
    if (!langSet.has(entry.language)) continue;
    const needle = entry.norm;
    let from = 0;
    while (from < haystack.length) {
      const idx = haystack.indexOf(needle, from);
      if (idx < 0) break;
      const end = idx + needle.length;
      const beforeOk = idx === 0 || !/[a-z0-9]/.test(haystack[idx - 1] ?? "");
      const afterOk = end >= haystack.length || !/[a-z0-9]/.test(haystack[end] ?? "");
      const overlaps = occupied.slice(idx, end).some(Boolean);
      if (beforeOk && afterOk && !overlaps) {
        hits.push({
          bookId: entry.bookId,
          alias: entry.alias,
          language: entry.language,
          source: entry.source,
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
