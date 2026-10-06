import { z } from "zod";
import { DEFAULT_SETTINGS } from "../constants/app";

export const LanguageModeSchema = z.enum(["english", "yoruba", "bilingual"]);
export const DetectionModeSchema = z.enum(["assisted", "automatic"]);
export const DetectionMethodSchema = z.enum([
  "direct",
  "contextual",
  "quotation",
  "semantic",
  "manual",
]);

export const AppSettingsSchema = z.object({
  general: z.object({
    languageMode: LanguageModeSchema,
    startMinimized: z.boolean(),
  }),
  bible: z.object({
    defaultTranslationId: z.string().min(1),
    secondaryTranslationId: z.string().nullable(),
  }),
  detection: z.object({
    mode: DetectionModeSchema,
    minConfidence: z.number().min(0).max(1),
  }),
  vmix: z.object({
    host: z.string().min(1),
    httpPort: z.number().int().positive(),
    tcpPort: z.number().int().positive(),
    enabled: z.boolean(),
  }),
  appearance: z.object({
    theme: z.enum(["dark", "light"]),
  }),
  advanced: z.object({
    logLevel: z.enum(["debug", "info", "warn", "error"]),
  }),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

export function parseSettings(input: unknown): AppSettings {
  const parsed = AppSettingsSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  return structuredClone(DEFAULT_SETTINGS);
}

export const VerseRefSchema = z.object({
  bookId: z.string().min(1),
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
  endVerse: z.number().int().positive().optional(),
});

export type VerseRef = z.infer<typeof VerseRefSchema>;

export const BibleVerseDtoSchema = z.object({
  translationId: z.string(),
  bookId: z.string(),
  chapter: z.number(),
  verse: z.number(),
  originalText: z.string(),
  referenceLabel: z.string(),
});

export type BibleVerseDto = z.infer<typeof BibleVerseDtoSchema>;

export const BibleSearchResultSchema = z.object({
  translationId: z.string(),
  bookId: z.string(),
  bookName: z.string(),
  chapter: z.number(),
  verse: z.number(),
  originalText: z.string(),
  referenceLabel: z.string(),
});

export type BibleSearchResult = z.infer<typeof BibleSearchResultSchema>;

export const TranslationInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  license: z.string(),
  attribution: z.string(),
  verseCount: z.number(),
});

export type TranslationInfo = z.infer<typeof TranslationInfoSchema>;

export const AppStatusSchema = z.object({
  appName: z.string(),
  version: z.string(),
  dbReady: z.boolean(),
  bibleReady: z.boolean(),
  sttStatus: z.enum(["unavailable", "idle", "listening", "error"]),
  vmixStatus: z.enum(["disconnected", "connected", "error"]),
});

export type AppStatus = z.infer<typeof AppStatusSchema>;
