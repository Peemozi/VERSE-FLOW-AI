import { create } from "zustand";
import type {
  AppSettings,
  AppStatus,
  BibleSearchResult,
  BibleVerseDto,
  DetectionEventDto,
  TranslationInfo,
} from "@shared/schemas";
import type { BibleBookInfo } from "@shared/types/ipc";
import { APP_NAME, DEFAULT_SETTINGS } from "@shared/constants/app";

interface AppState {
  status: AppStatus | null;
  settings: AppSettings;
  translations: TranslationInfo[];
  books: BibleBookInfo[];
  preview: BibleVerseDto | null;
  live: BibleVerseDto | null;
  searchResults: BibleSearchResult[];
  searchQuery: string;
  selectedTranslationId: string;
  loading: boolean;
  error: string | null;
  simulationText: string;
  simulationLog: string[];
  detections: DetectionEventDto[];
  suppressedCount: number;
  detectionContext: {
    bookId: string | null;
    chapter: number | null;
    verse: number | null;
  } | null;
  bootstrap: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setSelectedTranslation: (id: string) => void;
  runSearch: () => Promise<void>;
  loadVerseToPreview: (result: BibleSearchResult) => Promise<void>;
  loadDetectionToPreview: (detection: DetectionEventDto) => Promise<void>;
  sendPreviewToLive: () => void;
  clearLive: () => void;
  setSimulationText: (text: string) => void;
  runSimulation: (opts?: { resetContext?: boolean }) => Promise<void>;
  resetDetection: () => Promise<void>;
}

function hasApi(): boolean {
  return typeof window !== "undefined" && typeof window.verseflow !== "undefined";
}

export const useAppStore = create<AppState>((set, get) => ({
  status: null,
  settings: structuredClone(DEFAULT_SETTINGS),
  translations: [],
  books: [],
  preview: null,
  live: null,
  searchResults: [],
  searchQuery: "",
  selectedTranslationId: DEFAULT_SETTINGS.bible.defaultTranslationId,
  loading: false,
  error: null,
  simulationText: "",
  simulationLog: [],
  detections: [],
  suppressedCount: 0,
  detectionContext: null,

  bootstrap: async () => {
    if (!hasApi()) {
      set({
        status: {
          appName: APP_NAME,
          version: "0.1.0",
          dbReady: false,
          bibleReady: false,
          sttStatus: "unavailable",
          vmixStatus: "disconnected",
        },
        error: "Desktop bridge unavailable — open via Electron.",
      });
      return;
    }
    set({ loading: true, error: null });
    try {
      const [status, settings, translations, books] = await Promise.all([
        window.verseflow.getStatus(),
        window.verseflow.getSettings(),
        window.verseflow.listTranslations(),
        window.verseflow.listBooks(),
      ]);
      const selected =
        translations.find((t) => t.id === settings.bible.defaultTranslationId)?.id ??
        translations[0]?.id ??
        settings.bible.defaultTranslationId;
      set({
        status,
        settings,
        translations,
        books,
        selectedTranslationId: selected,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  refreshStatus: async () => {
    if (!hasApi()) return;
    const status = await window.verseflow.getStatus();
    set({ status });
  },

  updateSettings: async (settings) => {
    if (!hasApi()) {
      set({ settings });
      return;
    }
    const saved = await window.verseflow.setSettings(settings);
    set({ settings: saved });
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  setSelectedTranslation: (id) => set({ selectedTranslationId: id }),

  runSearch: async () => {
    const { searchQuery, selectedTranslationId } = get();
    if (!hasApi() || !searchQuery.trim()) {
      set({ searchResults: [] });
      return;
    }
    const results = await window.verseflow.searchBible({
      translationId: selectedTranslationId,
      query: searchQuery,
      limit: 30,
    });
    set({ searchResults: results });
  },

  loadVerseToPreview: async (result) => {
    if (!hasApi()) {
      set({
        preview: {
          translationId: result.translationId,
          bookId: result.bookId,
          chapter: result.chapter,
          verse: result.verse,
          originalText: result.originalText,
          referenceLabel: result.referenceLabel,
        },
      });
      return;
    }
    const verse = await window.verseflow.getVerse({
      translationId: result.translationId,
      ref: { bookId: result.bookId, chapter: result.chapter, verse: result.verse },
    });
    set({ preview: verse });
  },

  loadDetectionToPreview: async (detection) => {
    if (detection.verseText) {
      set({
        preview: {
          translationId: detection.translationId,
          bookId: detection.bookId,
          chapter: detection.chapter,
          verse: detection.verse,
          originalText: detection.verseText,
          referenceLabel: detection.referenceLabel,
        },
      });
      return;
    }
    if (!hasApi()) return;
    const verse = await window.verseflow.getVerse({
      translationId: detection.translationId,
      ref: {
        bookId: detection.bookId,
        chapter: detection.chapter,
        verse: detection.verse,
      },
    });
    set({ preview: verse });
  },

  sendPreviewToLive: () => {
    const { preview } = get();
    if (preview) set({ live: preview });
  },

  clearLive: () => set({ live: null }),

  setSimulationText: (text) => set({ simulationText: text }),

  runSimulation: async (opts) => {
    const { simulationText, selectedTranslationId, simulationLog } = get();
    const text = simulationText.trim();
    if (!text) return;
    if (!hasApi()) {
      set({ error: "Simulation requires the Electron bridge." });
      return;
    }
    const result = await window.verseflow.simulateTranscript({
      text,
      translationId: selectedTranslationId,
      resetContext: opts?.resetContext,
    });
    set({
      detections: [...result.detections, ...get().detections].slice(0, 50),
      suppressedCount: get().suppressedCount + result.suppressed.length,
      detectionContext: {
        bookId: result.context.bookId,
        chapter: result.context.chapter,
        verse: result.context.verse,
      },
      simulationLog: [`→ ${text}`, ...simulationLog].slice(0, 40),
      simulationText: "",
    });
    if (result.detections[0]) {
      await get().loadDetectionToPreview(result.detections[0]);
    }
  },

  resetDetection: async () => {
    if (hasApi()) await window.verseflow.resetDetection();
    set({
      detections: [],
      suppressedCount: 0,
      detectionContext: null,
      simulationLog: [],
    });
  },
}));
