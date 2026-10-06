/**
 * Generates English cardinal word maps for chapters (1–150) and verses (1–176).
 * Reviewer-correctable JSON is also shipped under resources/numbers/.
 */
function underTwenty(n: number): string {
  const words = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  return words[n] ?? String(n);
}

function tensWord(n: number): string {
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  return tens[n] ?? "";
}

export function numberToEnglishWords(n: number): string {
  if (n < 20) return underTwenty(n);
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return r === 0 ? tensWord(t) : `${tensWord(t)} ${underTwenty(r)}`;
  }
  if (n < 200) {
    const r = n % 100;
    if (r === 0) return "one hundred";
    if (r < 10) return `one hundred and ${underTwenty(r)}`;
    return `one hundred and ${numberToEnglishWords(r)}`;
  }
  return String(n);
}

export function buildEnglishNumberMap(max: number): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 1; i <= max; i++) {
    const words = numberToEnglishWords(i);
    map[words] = i;
    map[words.replace(/ and /g, " ")] = i;
    map[String(i)] = i;
  }
  // Common speech variants
  map["a"] = 1;
  return map;
}
