import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  shouldAutoLive,
  resolveOperatorShortcut,
  isEditableKeyboardTarget,
  exportHistoryCsv,
  exportHistoryJson,
} from "../../../src/shared/operator/workflow";
import { openTestDatabase, closeDatabase } from "../../../src/main/database/connection";
import { SessionHistoryRepository } from "../../../src/main/sessions/SessionHistoryRepository";
import { MIGRATIONS } from "../../../src/main/database/migrations";

function keyEvent(
  partial: Partial<{
    key: string;
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    target: EventTarget | null;
  }>,
) {
  return {
    key: "a",
    code: "KeyA",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
    ...partial,
  };
}

describe("shouldAutoLive", () => {
  it("never auto-lives in assisted mode", () => {
    expect(shouldAutoLive("assisted", 0.99, 0.7)).toBe(false);
  });

  it("auto-lives in automatic mode at/above threshold", () => {
    expect(shouldAutoLive("automatic", 0.7, 0.7)).toBe(true);
    expect(shouldAutoLive("automatic", 0.69, 0.7)).toBe(false);
  });
});

describe("operator shortcuts", () => {
  it("maps Space/Enter/Esc/P/Q/L/arrows", () => {
    expect(resolveOperatorShortcut(keyEvent({ key: " " }))).toBe("previewToLive");
    expect(resolveOperatorShortcut(keyEvent({ key: "Enter" }))).toBe("previewToLive");
    expect(resolveOperatorShortcut(keyEvent({ key: "Escape" }))).toBe("clearLive");
    expect(resolveOperatorShortcut(keyEvent({ key: "ArrowUp" }))).toBe("selectPrev");
    expect(resolveOperatorShortcut(keyEvent({ key: "ArrowDown" }))).toBe("selectNext");
    expect(resolveOperatorShortcut(keyEvent({ key: "p" }))).toBe("detectionToPreview");
    expect(resolveOperatorShortcut(keyEvent({ key: "q" }))).toBe("enqueuePreview");
    expect(resolveOperatorShortcut(keyEvent({ key: "l" }))).toBe("liveFromQueueOrPreview");
    expect(resolveOperatorShortcut(keyEvent({ key: "k", ctrlKey: true }))).toBe("focusSearch");
  });

  it("ignores plain keys while typing in inputs but allows Ctrl/Cmd+K", () => {
    const input = { tagName: "INPUT", isContentEditable: false, closest: () => null };
    expect(isEditableKeyboardTarget(input as unknown as EventTarget)).toBe(true);
    expect(resolveOperatorShortcut(keyEvent({ key: " ", target: input as unknown as EventTarget }))).toBeNull();
    expect(
      resolveOperatorShortcut(keyEvent({ key: "k", ctrlKey: true, target: input as unknown as EventTarget })),
    ).toBe("focusSearch");
  });
});

describe("history export", () => {
  const rows = [
    {
      id: 1,
      sessionId: "s1",
      kind: "live",
      bookId: "JHN",
      chapter: 3,
      verse: 16,
      endVerse: null,
      referenceLabel: "John 3:16",
      translationId: "WEB",
      verseText: "For God so loved the world",
      confidence: 0.9,
      method: "direct",
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("exports CSV without audio fields", () => {
    const csv = exportHistoryCsv(rows);
    expect(csv).toContain("referenceLabel");
    expect(csv).toContain("John 3:16");
    expect(csv.toLowerCase()).not.toContain("audio");
  });

  it("exports JSON with includesAudio false", () => {
    const json = JSON.parse(exportHistoryJson(rows)) as {
      includesAudio: boolean;
      count: number;
    };
    expect(json.includesAudio).toBe(false);
    expect(json.count).toBe(1);
  });
});

describe("SessionHistoryRepository", () => {
  let repo: SessionHistoryRepository;

  beforeEach(() => {
    const db = openTestDatabase(":memory:");
    repo = new SessionHistoryRepository(db);
  });

  afterEach(() => {
    closeDatabase();
  });

  it("includes operator_events migration", () => {
    expect(MIGRATIONS.some((m) => m.id === "002_operator_events")).toBe(true);
  });

  it("records and lists operator events", () => {
    repo.record({
      kind: "live",
      bookId: "JHN",
      chapter: 3,
      verse: 16,
      referenceLabel: "John 3:16",
      translationId: "WEB",
      verseText: "For God so loved the world",
    });
    const list = repo.list();
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("live");
    expect(list[0].referenceLabel).toBe("John 3:16");
  });
});
