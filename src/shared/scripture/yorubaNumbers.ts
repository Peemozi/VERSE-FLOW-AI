/**
 * Yoruba cardinal number helpers for matching (chapters 1–150, verses 1–176).
 * Prefer verified base forms; compounds are generated conservatively as
 * "{tens} ati {unit}" / "ogorun ati {n}" — reviewer-correctable via numbers.yo.json.
 */

export interface YorubaNumberResources {
  /** Hand-verified word → value (normalized keys applied by loader). */
  verified: Record<string, number>;
  /** Optional reviewer overrides / corrections (win over generated). */
  overrides?: Record<string, number>;
}

const UNIT_WORDS: Record<number, string[]> = {
  1: ["okan", "eni", "ookan"],
  2: ["eji", "meji"],
  3: ["eta", "meta"],
  4: ["erin", "merin"],
  5: ["arun", "marun"],
  6: ["efa", "mefa"],
  7: ["eje", "meje"],
  8: ["ejo", "mejo"],
  9: ["esan", "mesan"],
};

const TEENS: Record<number, string[]> = {
  10: ["ewa", "mewa"],
  11: ["ookanla", "mokanla", "okanla"],
  12: ["mejila"],
  13: ["metala"],
  14: ["merinla"],
  15: ["medogun", "meedogun"],
  16: ["merindilogun"],
  17: ["metadilogun"],
  18: ["mejidilogun"],
  19: ["okandilogun", "mokandilogun"],
};

/** Verified round tens / hundreds used in church speech matching. */
const ROUND: Record<number, string[]> = {
  20: ["ogun"],
  30: ["ogbon"],
  40: ["ogoji"],
  50: ["aadota"],
  60: ["ogota"],
  70: ["aadomewa"],
  80: ["ogorin"],
  90: ["aadorun"],
  100: ["ogorun"],
  150: ["ogorun aadota", "ogorun ati aadota"],
};

/** Compact verified starter map — mirrored into resources/numbers/numbers.yo.json. */
export function verifiedYorubaBases(): Record<string, number> {
  const map: Record<string, number> = {};
  const add = (words: string[], n: number) => {
    for (const w of words) map[w] = n;
  };
  for (const [n, words] of Object.entries(UNIT_WORDS)) add(words, Number(n));
  for (const [n, words] of Object.entries(TEENS)) add(words, Number(n));
  for (const [n, words] of Object.entries(ROUND)) add(words, Number(n));
  // Common "le logun" forms for 21–25 (verified liturgical speech patterns)
  add(["mokanlelogun", "okanlelogun"], 21);
  add(["mejilelogun"], 22);
  add(["metalelogun"], 23);
  add(["merinlelogun"], 24);
  add(["medogbon", "meedogbon"], 25);
  return map;
}

function wordsForValue(map: Record<string, number>, n: number): string[] {
  return Object.entries(map)
    .filter(([k, v]) => v === n && !/^\d+$/.test(k))
    .map(([k]) => k);
}

/**
 * Build a full lookup for 1..max using verified bases + conservative "ati" compounds.
 * Generated compounds are intentionally simple so reviewers can override in JSON.
 */
export function buildYorubaNumberMap(
  max: number,
  resources?: YorubaNumberResources,
): Record<string, number> {
  const map: Record<string, number> = { ...verifiedYorubaBases() };
  if (resources?.verified) {
    Object.assign(map, resources.verified);
  }

  for (let i = 1; i <= max; i++) {
    map[String(i)] = i;
  }

  const tensList = [20, 30, 40, 50, 60, 70, 80, 90];

  for (const tens of tensList) {
    const tensWords = wordsForValue(map, tens);
    for (let u = 1; u <= 9; u++) {
      const value = tens + u;
      if (value > max) continue;
      const unitWords = UNIT_WORDS[u] ?? wordsForValue(map, u);
      for (const tw of tensWords) {
        for (const uw of unitWords) {
          map[`${tw} ati ${uw}`] = value;
          map[`${tw} ${uw}`] = value;
        }
      }
    }
  }

  const hundredWords = wordsForValue(map, 100);
  for (let r = 1; r <= Math.min(76, max - 100); r++) {
    const value = 100 + r;
    if (value > max) break;
    const remWords = wordsForValue(map, r);
    for (const hw of hundredWords) {
      map[`${hw} ati ${r}`] = value;
      for (const rw of remWords.slice(0, 6)) {
        map[`${hw} ati ${rw}`] = value;
        map[`${hw} ${rw}`] = value;
      }
    }
  }

  if (resources?.overrides) {
    Object.assign(map, resources.overrides);
  }

  return map;
}
