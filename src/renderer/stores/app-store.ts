import { create } from "zustand";
import type { AppSettings, AppStatus, BibleSearchResult, BibleVerseDto, TranslationInfo } from "@shared/schemas";
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
  bootstrap: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setSelectedTranslation: (id: string) => void;
  runSearch: () => Promise<void>;
  loadVerseToPreview: (result: BibleSearchResult) => Promise<void>;
  sendPreviewToLive: () => void;
  clearLive: () => void;
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

  sendPreviewToLive: () => {
    const { preview } = get();
    if (preview) set({ live: preview });
  },

  clearLive: () => set({ live: null }),
}));
