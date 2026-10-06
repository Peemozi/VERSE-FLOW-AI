import fs from "node:fs";
import path from "node:path";
import { ENGLISH_NUMBER_MAP } from "./numbers.en";
import { normalizeForMatch } from "./yorubaNormalizer";
import {
  buildYorubaNumberMap,
  verifiedYorubaBases,
} from "../../shared/scripture/yorubaNumbers";

export type NumberLanguage = "en" | "yo" | "auto";

let yoMapCache: Record<string, number> | null = null;

function loadYorubaNumberMap(): Record<string, number> {
  if (yoMapCache) return yoMapCache;
  const candidates = [
    path.join(process.cwd(), "resources", "numbers", "numbers.yo.json"),
    path.join(__dirname, "../../../resources/numbers/numbers.yo.json"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const verified: Record<string, number> = {};
    const overrides: Record<string, number> = {};
    const flat: Record<string, number> = {};

    const verifiedBlock = (raw._verified as Record<string, unknown> | undefined) ?? {};
    const overrideBlock = (raw._overrides as Record<string, unknown> | undefined) ?? {};

    for (const [k, v] of Object.entries(verifiedBlock)) {
      if (typeof v === "number") verified[normalizeForMatch(k)] = v;
    }
    for (const [k, v] of Object.entries(overrideBlock)) {
      if (typeof v === "number") overrides[normalizeForMatch(k)] = v;
    }
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith("_")) continue;
      if (typeof v === "number") flat[normalizeForMatch(k)] = v;
    }

    // Prefer file flat entries (includes generated + verified); fill gaps via builder
    const built = buildYorubaNumberMap(176, {
      verified: Object.keys(verified).length ? verified : verifiedYorubaBases(),
      overrides,
    });
    const merged: Record<string, number> = {};
    for (const [k, v] of Object.entries(built)) {
      merged[normalizeForMatch(k)] = v;
    }
    Object.assign(merged, flat);
    Object.assign(merged, overrides);
    yoMapCache = merged;
    return yoMapCache;
  }

  const built = buildYorubaNumberMap(176, { verified: verifiedYorubaBases() });
  yoMapCache = Object.fromEntries(
    Object.entries(built).map(([k, v]) => [normalizeForMatch(k), v]),
  );
  return yoMapCache;
}

/** For tests — inject Yoruba number map without filesystem. */
export function setYorubaNumberMapForTests(map: Record<string, number>): void {
  yoMapCache = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [normalizeForMatch(k), v]),
  );
}

export function resetYorubaNumberMapForTests(): void {
  yoMapCache = null;
}

export function getYorubaNumberMap(): Record<string, number> {
  return { ...loadYorubaNumberMap() };
}

export function parseSpokenNumber(
  raw: string,
  language: NumberLanguage = "auto",
): number | null {
  const key = normalizeForMatch(raw);
  if (!key) return null;

  if (/^\d+$/.test(key)) {
    const n = Number(key);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const tryEn = language === "en" || language === "auto";
  const tryYo = language === "yo" || language === "auto";

  if (tryEn) {
    const en = ENGLISH_NUMBER_MAP[key];
    if (en != null) return en;
    const spaced = key.replace(/-/g, " ");
    if (ENGLISH_NUMBER_MAP[spaced] != null) return ENGLISH_NUMBER_MAP[spaced];
  }

  if (tryYo) {
    const yo = loadYorubaNumberMap()[key];
    if (yo != null) return yo;
  }

  return null;
}

/**
 * Replace spoken number phrases in text with digits (longest-match).
 * Keeps unmatched tokens intact.
 */
export function digitizeSpokenNumbers(text: string, language: NumberLanguage = "auto"): string {
  const tokens = normalizeForMatch(text).split(" ");
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    // Allow longer Yoruba compounds ("ogorun ati merindilogun")
    for (let len = Math.min(8, tokens.length - i); len >= 1; len--) {
      const slice = tokens.slice(i, i + len).join(" ");
      const n = parseSpokenNumber(slice, language);
      if (n != null && !/^\d+$/.test(slice)) {
        out.push(String(n));
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return out.join(" ");
}
