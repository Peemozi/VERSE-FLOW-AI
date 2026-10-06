import { describe, expect, it, beforeEach } from "vitest";
import { openTestDatabase, closeDatabase } from "../../../src/main/database/connection";
import { BibleRepository, normalizedForSearch } from "../../../src/main/database/BibleRepository";
import { ScriptureDetector } from "../../../src/main/scripture/ScriptureDetector";
import { parseReferences } from "../../../src/main/scripture/referenceParser";
import { validateReference } from "../../../src/main/scripture/referenceValidator";
import { ContextTracker } from "../../../src/main/scripture/contextTracker";
import { DuplicateSuppressor } from "../../../src/main/scripture/duplicateSuppressor";
import { digitizeSpokenNumbers, setYorubaNumberMapForTests } from "../../../src/main/scripture/numberNormalizer";
import { resetAliasTableForTests } from "../../../src/main/scripture/bookAliasEngine";
import { yorubaNormalize } from "../../../src/main/scripture/yorubaNormalizer";

describe("normalization", () => {
  it("strips Yoruba diacritics for matching only", () => {
    expect(yorubaNormalize("Johanu")).toBe("johanu");
    expect(yorubaNormalize("Ọlọ́run")).toBe("olorun");
  });

  it("digitizes English spoken numbers", () => {
    expect(digitizeSpokenNumbers("john chapter three verse sixteen", "en")).toContain("3");
    expect(digitizeSpokenNumbers("john chapter three verse sixteen", "en")).toContain("16");
  });
});

describe("English direct reference parsing", () => {
  beforeEach(() => {
    resetAliasTableForTests();
  });

  it("parses compact John 3:16", () => {
    const hits = parseReferences("Please open John 3:16 with me");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      method: "direct",
      bookId: "JHN",
      chapter: 3,
      verse: 16,
    });
    expect(hits[0].confidence).toBeGreaterThan(0.7);
  });

  it("parses spoken form with number words", () => {
    const hits = parseReferences("John chapter three verse sixteen");
    expect(hits[0]).toMatchObject({ bookId: "JHN", chapter: 3, verse: 16, method: "direct" });
  });

  it("parses verse ranges", () => {
    const hits = parseReferences("Romans 8:28-30");
    expect(hits[0]).toMatchObject({
      bookId: "ROM",
      chapter: 8,
      verse: 28,
      endVerse: 30,
    });
  });

  it("parses numbered books", () => {
    const hits = parseReferences("1 Corinthians 13:4");
    expect(hits[0]).toMatchObject({ bookId: "1CO", chapter: 13, verse: 4 });
  });
});

describe("contextual parsing", () => {
  it("resolves verse N after book context", () => {
    const tracker = new ContextTracker({ ttlMs: 60_000 });
    tracker.update({ bookId: "JHN", chapter: 3, verse: 16 }, 1_000);
    const hits = parseReferences("and verse 17", {
      context: tracker.get(1_500),
      contextStrength: tracker.strength(1_500),
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      method: "contextual",
      bookId: "JHN",
      chapter: 3,
      verse: 17,
    });
  });

  it("resolves chapter+verse with context book", () => {
    const tracker = new ContextTracker({ ttlMs: 60_000 });
    tracker.update({ bookId: "PSA", chapter: 23, verse: 1 }, 1_000);
    const hits = parseReferences("chapter 24 verse 1", {
      context: tracker.get(1_200),
      contextStrength: 1,
    });
    expect(hits[0]).toMatchObject({ bookId: "PSA", chapter: 24, verse: 1, method: "contextual" });
  });

  it("does not contextual-match without context", () => {
    const hits = parseReferences("verse 17");
    expect(hits).toHaveLength(0);
  });
});

describe("invalid references", () => {
  it("rejects impossible chapters", () => {
    expect(validateReference({ bookId: "JHN", chapter: 99, verse: 1 }).ok).toBe(false);
  });

  it("rejects inverted ranges", () => {
    expect(validateReference({ bookId: "JHN", chapter: 3, verse: 18, endVerse: 16 }).ok).toBe(
      false,
    );
  });

  it("parser drops invalid direct refs", () => {
    const hits = parseReferences("John 99:1");
    expect(hits).toHaveLength(0);
  });
});

describe("duplicate suppression", () => {
  it("suppresses identical refs inside the window", () => {
    const suppressor = new DuplicateSuppressor({ windowMs: 10_000 });
    const a = {
      bookId: "JHN" as const,
      chapter: 3,
      verse: 16,
      method: "direct" as const,
      confidence: 0.9,
    };
    const first = suppressor.filter([a], 1000);
    expect(first.kept).toHaveLength(1);
    const second = suppressor.filter([a], 2000);
    expect(second.kept).toHaveLength(0);
    expect(second.suppressed).toHaveLength(1);
  });
});

describe("Yoruba verified aliases", () => {
  beforeEach(() => {
    resetAliasTableForTests();
    setYorubaNumberMapForTests({ meta: 3, merindilogun: 16, okan: 1 });
  });

  it("parses Johanu with compact reference", () => {
    const hits = parseReferences("Johanu 3:16", { languages: ["yo", "en"] });
    expect(hits[0]).toMatchObject({ bookId: "JHN", chapter: 3, verse: 16 });
  });

  it("parses Saamu (Psalms) alias", () => {
    const hits = parseReferences("Saamu 23:1", { languages: ["yo", "en"] });
    expect(hits[0]).toMatchObject({ bookId: "PSA", chapter: 23, verse: 1 });
  });

  it("does not invent unknown Yoruba book forms", () => {
    const hits = parseReferences("FakeBooku 1:1", { languages: ["yo"] });
    expect(hits).toHaveLength(0);
  });
});

describe("ScriptureDetector simulation pipeline", () => {
  let detector: ScriptureDetector;

  beforeEach(() => {
    resetAliasTableForTests();
    closeDatabase();
    const db = openTestDatabase(":memory:");
    const repo = new BibleRepository(db);
    repo.seedCanonicalBooks();
    repo.upsertTranslation({
      id: "WEB",
      name: "World English Bible",
      language: "en",
      license: "Public Domain",
      attribution: "test",
    });
    repo.insertVerses([
      {
        translationId: "WEB",
        bookId: "JHN",
        chapter: 3,
        verse: 16,
        originalText: "For God so loved the world...",
        normalizedText: normalizedForSearch("For God so loved the world..."),
      },
      {
        translationId: "WEB",
        bookId: "JHN",
        chapter: 3,
        verse: 17,
        originalText: "For God did not send his Son...",
        normalizedText: normalizedForSearch("For God did not send his Son..."),
      },
    ]);

    detector = new ScriptureDetector({
      translationId: "WEB",
      duplicateWindowMs: 30_000,
      verseExists: (bookId, chapter, verse) =>
        Boolean(repo.getVerse("WEB", bookId, chapter, verse)),
      getVerse: (translationId, bookId, chapter, verse) =>
        repo.getVerse(translationId, bookId, chapter, verse),
    });
  });

  it("direct → context → duplicate in one session", () => {
    const t0 = 1_000_000;
    const first = detector.processTranscript("John 3:16", t0);
    expect(first.detections).toHaveLength(1);
    expect(first.detections[0].referenceLabel).toBe("John 3:16");
    expect(first.detections[0].verseText).toContain("loved the world");

    const second = detector.processTranscript("verse 17", t0 + 1000);
    expect(second.detections).toHaveLength(1);
    expect(second.detections[0]).toMatchObject({
      method: "contextual",
      verse: 17,
      bookId: "JHN",
    });

    const dup = detector.processTranscript("John 3:16", t0 + 2000);
    expect(dup.detections).toHaveLength(0);
    expect(dup.suppressed).toHaveLength(1);
  });

  it("rejects DB-missing verses when bible loaded", () => {
    const result = detector.processTranscript("John 3:99", 5_000);
    expect(result.detections).toHaveLength(0);
  });
});
