import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NoOpEmbeddingProvider,
  cosineSimilarity,
  createEmbeddingProvider,
} from "../../../src/main/scripture/EmbeddingProvider";
import {
  NoOpReferenceInterpretationProvider,
  validateInterpretedReferences,
} from "../../../src/main/scripture/ReferenceInterpretationProvider";
import { SemanticMatcher } from "../../../src/main/scripture/SemanticMatcher";
import { ScriptureDetector } from "../../../src/main/scripture/ScriptureDetector";

describe("EmbeddingProvider stubs", () => {
  it("default factory is unavailable no-op", async () => {
    const p = createEmbeddingProvider();
    expect(p.available).toBe(false);
    expect(await p.embed(["hello"])).toEqual([]);
  });

  it("cosineSimilarity handles empty and orthogonal vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });
});

describe("ReferenceInterpretationProvider", () => {
  it("noop returns empty", async () => {
    const p = new NoOpReferenceInterpretationProvider();
    expect(p.available).toBe(false);
    expect(await p.interpret("anything")).toEqual([]);
  });

  it("validateInterpretedReferences drops DB-missing refs", () => {
    const kept = validateInterpretedReferences(
      [
        { bookId: "JHN", chapter: 3, verse: 16, confidence: 0.9 },
        { bookId: "ZZZ", chapter: 1, verse: 1, confidence: 0.99 },
      ],
      (bookId) => bookId === "JHN",
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.bookId).toBe("JHN");
  });
});

describe("SemanticMatcher async path", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("disabled matcher returns empty without blocking", async () => {
    const matcher = new SemanticMatcher({
      embedding: new NoOpEmbeddingProvider(),
      enabled: false,
      translationId: "WEB",
    });
    const t0 = performance.now();
    const result = await matcher.run("For God so loved the world that he gave his only son");
    expect(result).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(20);
  });

  it("schedule does not delay direct processTranscript", () => {
    const matcher = new SemanticMatcher({
      embedding: new NoOpEmbeddingProvider(),
      enabled: true,
      translationId: "WEB",
    });
    const detector = new ScriptureDetector({ semanticMatcher: matcher });
    const t0 = performance.now();
    const result = detector.processTranscript("John 3:16");
    const elapsed = performance.now() - t0;
    expect(result.detections[0]?.method).toBe("direct");
    expect(elapsed).toBeLessThan(50);

    let called = false;
    detector.scheduleSemanticSuggestions("some long enough paraphrase about love", result, () => {
      called = true;
    });
    // schedule is async; direct already finished
    expect(called).toBe(false);
  });

  it("fake embedding provider can surface a suggestion when enabled", async () => {
    const fake: import("../../../src/main/scripture/EmbeddingProvider").EmbeddingProvider = {
      id: "fake",
      available: true,
      displayName: "Fake",
      dimensions: () => 2,
      async embed(texts: string[]) {
        return texts.map((t) => (t.includes("shepherd") ? [1, 0] : [0.9, 0.1]));
      },
    };
    const matcher = new SemanticMatcher({
      embedding: fake,
      enabled: true,
      minConfidence: 0.8,
      translationId: "WEB",
      corpus: [
        {
          bookId: "PSA",
          chapter: 23,
          verse: 1,
          text: "The Lord is my shepherd I shall not want",
          embedding: [1, 0],
          referenceLabel: "Psalms 23:1",
        },
      ],
    });
    const hits = await matcher.run("something about a shepherd tending sheep carefully enough");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.bookId).toBe("PSA");
    expect(hits[0]?.source).toBe("embedding");
  });
});
