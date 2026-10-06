import type { DetectionMethod, DetectionMode } from "../schemas";

/**
 * Automatic mode sends high-confidence detections straight to LIVE.
 * Quotation matches use a higher configurable bar than direct refs.
 */
export function shouldAutoLive(
  mode: DetectionMode,
  confidence: number,
  minConfidence: number,
  options?: {
    method?: DetectionMethod;
    quotationMinConfidence?: number;
  },
): boolean {
  if (mode !== "automatic") return false;
  if (options?.method === "quotation") {
    const bar = options.quotationMinConfidence ?? Math.max(minConfidence, 0.9);
    return confidence >= bar;
  }
  return confidence >= minConfidence;
}

export type OperatorShortcutAction =
  | "previewToLive"
  | "clearLive"
  | "focusSearch"
  | "selectPrev"
  | "selectNext"
  | "detectionToPreview"
  | "enqueuePreview"
  | "liveFromQueueOrPreview";

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  };
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  if (typeof el.closest === "function") {
    try {
      if (el.closest("[contenteditable='true']")) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Map a keydown to an operator action.
 * Returns null when the event should be ignored (typing, unmatched, etc.).
 */
export function resolveOperatorShortcut(
  e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "target">,
): OperatorShortcutAction | null {
  if (isEditableKeyboardTarget(e.target as EventTarget | null)) {
    // Allow Ctrl/Cmd+K even from inputs so operators can jump to search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") return "focusSearch";
    return null;
  }
  if (e.altKey) return null;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") return "focusSearch";
  if (e.ctrlKey || e.metaKey) return null;

  switch (e.key) {
    case " ":
    case "Spacebar":
      return "previewToLive";
    case "Enter":
      return "previewToLive";
    case "Escape":
      return "clearLive";
    case "ArrowUp":
      return "selectPrev";
    case "ArrowDown":
      return "selectNext";
    case "p":
    case "P":
      return "detectionToPreview";
    case "q":
    case "Q":
      return "enqueuePreview";
    case "l":
    case "L":
      return "liveFromQueueOrPreview";
    default:
      return null;
  }
}

export interface HistoryExportRow {
  id: number;
  sessionId: string;
  kind: string;
  bookId: string | null;
  chapter: number | null;
  verse: number | null;
  endVerse: number | null;
  referenceLabel: string | null;
  translationId: string | null;
  verseText: string | null;
  confidence: number | null;
  method: string | null;
  notes: string | null;
  createdAt: string;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Export operator history as CSV — never includes audio. */
export function exportHistoryCsv(rows: HistoryExportRow[]): string {
  const headers = [
    "id",
    "sessionId",
    "kind",
    "bookId",
    "chapter",
    "verse",
    "endVerse",
    "referenceLabel",
    "translationId",
    "verseText",
    "confidence",
    "method",
    "notes",
    "createdAt",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.sessionId,
        row.kind,
        row.bookId ?? "",
        row.chapter ?? "",
        row.verse ?? "",
        row.endVerse ?? "",
        row.referenceLabel ?? "",
        row.translationId ?? "",
        row.verseText ?? "",
        row.confidence ?? "",
        row.method ?? "",
        row.notes ?? "",
        row.createdAt,
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Export operator history as JSON — never includes audio. */
export function exportHistoryJson(rows: HistoryExportRow[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      includesAudio: false,
      count: rows.length,
      events: rows,
    },
    null,
    2,
  );
}
