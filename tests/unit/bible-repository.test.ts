import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openTestDatabase, closeDatabase } from "../../src/main/database/connection";
import { BibleRepository, normalizedForSearch } from "../../src/main/database/BibleRepository";
import { CANONICAL_BOOKS } from "../../src/shared/scripture/books";
import { parseSettings, AppSettingsSchema } from "../../src/shared/schemas";
import { DEFAULT_SETTINGS, APP_NAME } from "../../src/shared/constants/app";
import { cleanUsfmText, parseUsfm } from "../../src/shared/scripture/usfm";

describe("app constants", () => {
  it("exposes configurable VerseFlow AI name", () => {
    expect(APP_NAME).toBe("VerseFlow AI");
  });
});

describe("settings schema", () => {
  it("parses defaults", () => {
    const parsed = AppSettingsSchema.parse(DEFAULT_SETTINGS);
    expect(parsed.bible.defaultTranslationId).toBe("WEB");
  });

  it("falls back on invalid input", () => {
    const parsed = parseSettings({ nope: true });
    expect(parsed.general.languageMode).toBe("english");
  });
});

describe("normalizedForSearch", () => {
  it("strips diacritics for Yoruba matching", () => {
    expect(normalizedForSearch("Ọlọ́run")).toBe("olorun");
  });
});

describe("USFM parser", () => {
  it("extracts verses from sample USFM", () => {
    const sample = `
\\id JHN John
\\c 3
\\v 16 For God so loved the world, that he gave his one and only Son,
\\v 17 For God did not send his Son into the world to judge the world.
`;
    const verses = parseUsfm(sample);
    expect(verses).toHaveLength(2);
    expect(verses[0]).toMatchObject({ bookId: "JHN", chapter: 3, verse: 16 });
    expect(verses[0].text).toContain("For God so loved");
  });

  it("strips USFM markers", () => {
    expect(cleanUsfmText("Hello \\add world\\add* \\f + footnote \\f*")).toBe("Hello world");
    expect(cleanUsfmText("\\+w For\\+w* \\+w God\\+w*")).toBe("For God");
  });
});

describe("BibleRepository", () => {
  let repo: BibleRepository;

  beforeEach(() => {
    const db = openTestDatabase(":memory:");
    repo = new BibleRepository(db);
    repo.seedCanonicalBooks();
    repo.upsertTranslation({
      id: "WEB",
      name: "World English Bible",
      language: "en",
      license: "Public Domain",
      attribution: "WEB public domain test fixture",
    });
    repo.insertVerses([
      {
        translationId: "WEB",
        bookId: "JHN",
        chapter: 3,
        verse: 16,
        originalText: "For God so loved the world, that he gave his one and only Son,",
        normalizedText: normalizedForSearch(
          "For God so loved the world, that he gave his one and only Son,",
        ),
      },
      {
        translationId: "WEB",
        bookId: "JHN",
        chapter: 1,
        verse: 1,
        originalText: "In the beginning was the Word, and the Word was with God,",
        normalizedText: normalizedForSearch(
          "In the beginning was the Word, and the Word was with God,",
        ),
      },
    ]);
  });

  afterEach(() => {
    closeDatabase();
  });

  it("seeds all canonical books", () => {
    expect(repo.listBooks()).toHaveLength(CANONICAL_BOOKS.length);
  });

  it("gets a verse by reference", () => {
    const verse = repo.getVerse("WEB", "JHN", 3, 16);
    expect(verse?.referenceLabel).toBe("John 3:16");
    expect(verse?.originalText).toContain("loved the world");
  });

  it("searches by text", () => {
    const results = repo.search("WEB", "beginning was the Word");
    expect(results[0]?.referenceLabel).toBe("John 1:1");
  });

  it("searches by reference hint", () => {
    const results = repo.search("WEB", "John 3:16");
    expect(results).toHaveLength(1);
    expect(results[0].verse).toBe(16);
  });

  it("reports verse counts on translations", () => {
    const list = repo.listTranslations();
    expect(list[0]?.verseCount).toBe(2);
  });
});
