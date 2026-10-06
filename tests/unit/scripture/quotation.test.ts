import { beforeEach, describe, expect, it } from "vitest";
import {
  BibleRepository,
  normalizedForSearch,
} from "../../../src/main/database/BibleRepository";
import { closeDatabase, openTestDatabase } from "../../../src/main/database/connection";
import { MIGRATIONS } from "../../../src/main/database/migrations";
import { QuotationDetector } from "../../../src/main/scripture/QuotationDetector";
import {
  buildFtsQuery,
  isGenericPhrase,
  meetsQuotationLength,
  rankQuotationCandidates,
} from "../../../src/main/scripture/quotationMatcher";
import { ScriptureDetector } from "../../../src/main/scripture/ScriptureDetector";
import { shouldAutoLive } from "../../../src/shared/operator/workflow";

const JOHN_316 =
  "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.";

const PSALM_23 =
  "Yahweh is my shepherd: I shall lack nothing. He makes me lie down in green pastures. He leads me beside still waters.";

describe("quotation helpers", () => {
  it("rejects tiny and generic phrases", () => {
    expect(meetsQuotationLength("God is good")).toBe(false);
    expect(isGenericPhrase("praise the lord")).toBe(true);
    expect(meetsQuotationLength("short")).toBe(false);
    expect(
      meetsQuotationLength(
        "For God so loved the world that he gave his one and only Son that whoever believes",
      ),
    ).toBe(true);
  });

  it("builds FTS query from significant tokens", () => {
    const q = buildFtsQuery(JOHN_316);
    expect(q).toBeTruthy();
    expect(q!).toContain('"loved"');
    expect(q!).not.toContain('"the"');
  });
});

describe("FTS5 quotation detection", () => {
  let repo: BibleRepository;

  beforeEach(() => {
    closeDatabase();
    const db = openTestDatabase(":memory:");
    repo = new BibleRepository(db);
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
        originalText: JOHN_316,
        normalizedText: normalizedForSearch(JOHN_316),
      },
      {
        translationId: "WEB",
        bookId: "PSA",
        chapter: 23,
        verse: 1,
        originalText: "Yahweh is my shepherd: I shall lack nothing.",
        normalizedText: normalizedForSearch("Yahweh is my shepherd: I shall lack nothing."),
      },
      {
        translationId: "WEB",
        bookId: "PSA",
        chapter: 23,
        verse: 2,
        originalText: "He makes me lie down in green pastures. He leads me beside still waters.",
        normalizedText: normalizedForSearch(
          "He makes me lie down in green pastures. He leads me beside still waters.",
        ),
      },
      {
        translationId: "WEB",
        bookId: "GEN",
        chapter: 1,
        verse: 1,
        originalText: "In the beginning, God created the heavens and the earth.",
        normalizedText: normalizedForSearch(
          "In the beginning, God created the heavens and the earth.",
        ),
      },
    ]);
  });

  it("includes FTS migration", () => {
    expect(MIGRATIONS.some((m) => m.id === "003_bible_verses_fts")).toBe(true);
  });

  it("matches a distinctive quoted verse via FTS", () => {
    const detector = new QuotationDetector({ repo, translationId: "WEB" });
    const quote =
      "For God so loved the world that he gave his one and only Son that whoever believes in him should not perish";
    const hits = detector.detect(quote);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatchObject({ bookId: "JHN", chapter: 3, verse: 16 });
    expect(hits[0]!.confidence).toBeGreaterThan(0.5);
  });

  it("does not fire on generic liturgical phrases", () => {
    const detector = new QuotationDetector({ repo, translationId: "WEB" });
    expect(detector.detect("Praise the Lord")).toHaveLength(0);
    expect(detector.detect("Amen")).toHaveLength(0);
    expect(detector.detect("God is good")).toHaveLength(0);
  });

  it("ranks exact substring higher", () => {
    const fts = repo.searchQuotation(
      "WEB",
      buildFtsQuery(JOHN_316)!,
      5,
    );
    const ranked = rankQuotationCandidates(JOHN_316, fts);
    expect(ranked[0]?.bookId).toBe("JHN");
    expect(ranked[0]!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("runs after direct path and does not block John 3:16 reference", () => {
    const quotationDetector = new QuotationDetector({ repo, translationId: "WEB" });
    const detector = new ScriptureDetector({
      translationId: "WEB",
      quotationDetector,
      verseExists: (b, c, v) => Boolean(repo.getVerse("WEB", b, c, v)),
      getVerse: (tid, b, c, v) => repo.getVerse(tid, b, c, v),
    });

    const t0 = performance.now();
    const result = detector.processTranscript("John 3:16");
    const elapsed = performance.now() - t0;

    expect(result.detections[0]?.method).toBe("direct");
    expect(result.detections[0]?.bookId).toBe("JHN");
    // Direct path must stay snappy even with FTS available
    expect(elapsed).toBeLessThan(80);
  });

  it("emits quotation as suggestion method", () => {
    const quotationDetector = new QuotationDetector({ repo, translationId: "WEB" });
    const detector = new ScriptureDetector({
      translationId: "WEB",
      quotationDetector,
      verseExists: (b, c, v) => Boolean(repo.getVerse("WEB", b, c, v)),
      getVerse: (tid, b, c, v) => repo.getVerse(tid, b, c, v),
    });

    const quote =
      "For God so loved the world that he gave his one and only Son that whoever believes in him should not perish but have eternal life";
    const result = detector.processTranscript(quote);
    const q = result.detections.find((d) => d.method === "quotation");
    expect(q).toBeTruthy();
    expect(q!.isSuggestion).toBe(true);
    expect(q!.bookId).toBe("JHN");
    expect(q!.chapter).toBe(3);
    expect(q!.verse).toBe(16);
    // Mid-range suggestion confidence should not clear the high auto-live bar by default
    expect(
      shouldAutoLive("automatic", q!.confidence, 0.7, {
        method: "quotation",
        quotationMinConfidence: 0.9,
      }),
    ).toBe(q!.confidence >= 0.9);
    void PSALM_23;
  });
});

describe("quotation auto-live gate", () => {
  it("low-confidence quotation does not auto-live", () => {
    expect(
      shouldAutoLive("automatic", 0.72, 0.7, {
        method: "quotation",
        quotationMinConfidence: 0.9,
      }),
    ).toBe(false);
  });

  it("high-confidence quotation can auto-live at higher bar", () => {
    expect(
      shouldAutoLive("automatic", 0.92, 0.7, {
        method: "quotation",
        quotationMinConfidence: 0.9,
      }),
    ).toBe(true);
  });

  it("direct still uses standard minConfidence", () => {
    expect(
      shouldAutoLive("automatic", 0.7, 0.7, {
        method: "direct",
        quotationMinConfidence: 0.9,
      }),
    ).toBe(true);
  });
});
