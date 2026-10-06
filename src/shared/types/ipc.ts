import type { AppSettings, AppStatus, BibleSearchResult, BibleVerseDto, TranslationInfo, VerseRef } from "../schemas";

/** Typed IPC channel names — keep in sync with preload + main handlers. */
export const IpcChannels = {
  APP_GET_STATUS: "app:getStatus",
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",
  BIBLE_LIST_TRANSLATIONS: "bible:listTranslations",
  BIBLE_LIST_BOOKS: "bible:listBooks",
  BIBLE_GET_VERSE: "bible:getVerse",
  BIBLE_SEARCH: "bible:search",
  LOG_WRITE: "log:write",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export interface BibleBookInfo {
  id: string;
  nameEn: string;
  order: number;
  chapters: number;
  testament: string;
}

export interface VerseFlowApi {
  getStatus: () => Promise<AppStatus>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: AppSettings) => Promise<AppSettings>;
  listTranslations: () => Promise<TranslationInfo[]>;
  listBooks: () => Promise<BibleBookInfo[]>;
  getVerse: (args: {
    translationId: string;
    ref: VerseRef;
  }) => Promise<BibleVerseDto | null>;
  searchBible: (args: {
    translationId: string;
    query: string;
    limit?: number;
  }) => Promise<BibleSearchResult[]>;
  log: (level: "debug" | "info" | "warn" | "error", message: string) => Promise<void>;
}

declare global {
  interface Window {
    verseflow: VerseFlowApi;
  }
}

export {};
