import { beforeEach, describe, expect, it } from "vitest";
import { resetAliasTableForTests } from "../../../src/main/scripture/bookAliasEngine";
import {
  digitizeSpokenNumbers,
  parseSpokenNumber,
  resetYorubaNumberMapForTests,
} from "../../../src/main/scripture/numberNormalizer";
import { parseReferences } from "../../../src/main/scripture/referenceParser";
import { diagnoseTranscript } from "../../../src/main/scripture/yorubaDiagnostics";
import { stripDiacritics, yorubaNormalize } from "../../../src/main/scripture/yorubaNormalizer";
import { buildYorubaNumberMap, verifiedYorubaBases } from "../../../src/shared/scripture/yorubaNumbers";

describe("Yoruba normalizer hardening", () => {
  it("folds underdotted vowels and s-dot", () => {
    expect(stripDiacritics("Ẹsẹ")).toBe("Ese");
    expect(stripDiacritics("Ọba")).toBe("Oba");
    expect(stripDiacritics("Joṣua")).toBe("Josua");
    expect(yorubaNormalize("Gẹnẹsisi")).toBe("genesisi");
    expect(yorubaNormalize("Kọrinti")).toBe("korinti");
    expect(yorubaNormalize("Ìfihàn")).toBe("ifihan");
  });
});

describe("Yoruba numbers coverage", () => {
  beforeEach(() => {
    resetYorubaNumberMapForTests();
  });

  it("covers verified bases 1–25 and round tens", () => {
    expect(parseSpokenNumber("merindilogun", "yo")).toBe(16);
    expect(parseSpokenNumber("ogun", "yo")).toBe(20);
    expect(parseSpokenNumber("aadota", "yo")).toBe(50);
    expect(parseSpokenNumber("ogorun", "yo")).toBe(100);
    expect(parseSpokenNumber("metalelogun", "yo")).toBe(23);
  });

  it("parses conservative ati compounds up to 176", () => {
    expect(parseSpokenNumber("ogun ati meta", "yo")).toBe(23);
    expect(parseSpokenNumber("ogorun ati mewa", "yo")).toBe(110);
    expect(parseSpokenNumber("ogorun ati 76", "yo")).toBe(176);
  });

  it("builder exposes digits 1–176", () => {
    const map = buildYorubaNumberMap(176, { verified: verifiedYorubaBases() });
    for (let i = 1; i <= 176; i++) {
      expect(map[String(i)]).toBe(i);
    }
  });

  it("digitizes spoken Yoruba in transcript", () => {
    const out = digitizeSpokenNumbers("johanu chapter meta verse merindilogun", "yo");
    expect(out).toContain("3");
    expect(out).toContain("16");
  });
});

describe("Yoruba verified alias detection suite", () => {
  beforeEach(() => {
    resetAliasTableForTests();
    resetYorubaNumberMapForTests();
  });

  const cases: Array<{ text: string; bookId: string; chapter: number; verse: number }> = [
    { text: "Johanu 3:16", bookId: "JHN", chapter: 3, verse: 16 },
    { text: "Saamu 23:1", bookId: "PSA", chapter: 23, verse: 1 },
    { text: "Matiu 5:3", bookId: "MAT", chapter: 5, verse: 3 },
    { text: "Gẹnẹsisi 1:1", bookId: "GEN", chapter: 1, verse: 1 },
    { text: "Eksodu 20:3", bookId: "EXO", chapter: 20, verse: 3 },
    { text: "Romu 8:28", bookId: "ROM", chapter: 8, verse: 28 },
    { text: "1 Kọrinti 13:4", bookId: "1CO", chapter: 13, verse: 4 },
    { text: "Ìfihàn 21:4", bookId: "REV", chapter: 21, verse: 4 },
    { text: "Jakọbu 1:2", bookId: "JAS", chapter: 1, verse: 2 },
    { text: "Òwe 3:5", bookId: "PRO", chapter: 3, verse: 5 },
  ];

  for (const c of cases) {
    it(`parses verified form: ${c.text}`, () => {
      const hits = parseReferences(c.text, { languages: ["yo", "en"], numberLanguage: "yo" });
      expect(hits[0]).toMatchObject({
        bookId: c.bookId,
        chapter: c.chapter,
        verse: c.verse,
      });
    });
  }

  it("parses spoken ori/ese with Yoruba numbers", () => {
    const hits = parseReferences("Johanu ori meta ese merindilogun", {
      languages: ["yo", "en"],
      numberLanguage: "yo",
    });
    expect(hits[0]).toMatchObject({ bookId: "JHN", chapter: 3, verse: 16 });
  });

  it("accepts safe ASR alias for Johanu", () => {
    const hits = parseReferences("Yohanu 3:16", { languages: ["yo"], numberLanguage: "yo" });
    expect(hits[0]?.bookId).toBe("JHN");
  });

  it("does not invent unknown books", () => {
    const hits = parseReferences("FakeBooku 1:1", { languages: ["yo"] });
    expect(hits).toHaveLength(0);
  });
});

describe("Yoruba diagnostics", () => {
  beforeEach(() => {
    resetAliasTableForTests();
    resetYorubaNumberMapForTests();
  });

  it("surfaces original, normalized, alias, numbers, ref, confidence", () => {
    const d = diagnoseTranscript("Johanu ori meta ese merindilogun", {
      languages: ["yo", "en"],
      numberLanguage: "yo",
    });
    expect(d.originalTranscript).toContain("Johanu");
    expect(d.normalizedTranscript).toContain("chapter");
    expect(d.normalizedTranscript).toContain("verse");
    expect(d.digitizedTranscript).toMatch(/3/);
    expect(d.digitizedTranscript).toMatch(/16/);
    expect(d.matchedAliases.some((a) => a.bookId === "JHN")).toBe(true);
    expect(d.parsedNumbers.some((n) => n.value === 3)).toBe(true);
    expect(d.parsedNumbers.some((n) => n.value === 16)).toBe(true);
    expect(d.resolvedRefs[0]).toMatchObject({ bookId: "JHN", chapter: 3, verse: 16 });
    expect(d.topConfidence).toBeGreaterThan(0.5);
    expect(d.resolvedRefs[0]?.matchedAlias).toBeTruthy();
  });
});
