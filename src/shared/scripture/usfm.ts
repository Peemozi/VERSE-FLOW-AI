import { USFM_TO_CANONICAL } from "./books";

export interface ParsedVerse {
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

/** Minimal USFM verse extractor — sufficient for WEB-style USFM. */
export function parseUsfm(content: string): ParsedVerse[] {
  const verses: ParsedVerse[] = [];
  let bookId: string | null = null;
  let chapter = 0;
  let verse = 0;
  let buffer = "";

  const flush = () => {
    const text = cleanUsfmText(buffer);
    if (bookId && chapter > 0 && verse > 0 && text) {
      verses.push({ bookId, chapter, verse, text });
    }
    buffer = "";
  };

  const idMatch = content.match(/\\id\s+(\S+)/);
  if (idMatch) {
    const code = idMatch[1].toUpperCase();
    bookId = USFM_TO_CANONICAL[code] ?? null;
  }

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const cMatch = line.match(/\\c\s+(\d+)/);
    if (cMatch) {
      flush();
      chapter = Number(cMatch[1]);
      verse = 0;
      continue;
    }

    if (line.includes("\\v ")) {
      const parts = line.split(/\\v\s+/);
      for (let i = 1; i < parts.length; i++) {
        flush();
        const m = parts[i].match(/^(\d+)\s*(.*)$/s);
        if (!m) continue;
        verse = Number(m[1]);
        buffer = m[2];
      }
      continue;
    }

    if (verse > 0) {
      buffer += (buffer ? " " : "") + line;
    }
  }
  flush();
  return verses;
}

/**
 * Strip USFM markup for display/search.
 * Order matters: remove |attributes while closing markers still bound them,
 * otherwise a greedy pipe strip can swallow the rest of the verse.
 */
export function cleanUsfmText(raw: string): string {
  return raw
    .replace(/\\f[\s\S]*?\\f\*/g, "")
    .replace(/\\x[\s\S]*?\\x\*/g, "")
    .replace(/\|[^\\]*/g, "")
    .replace(/\\\+?[a-zA-Z]+\d*\*?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
