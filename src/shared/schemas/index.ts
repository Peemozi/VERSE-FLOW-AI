import { z } from "zod";
import { DEFAULT_SETTINGS } from "../constants/app";

export const LanguageModeSchema = z.enum(["english", "yoruba", "bilingual"]);
export type LanguageMode = z.infer<typeof LanguageModeSchema>;
export const DetectionModeSchema = z.enum(["assisted", "automatic"]);
export type DetectionMode = z.infer<typeof DetectionModeSchema>;
export const DetectionMethodSchema = z.enum([
  "direct",
  "contextual",
  "quotation",
  "semantic",
  "manual",
]);
export type DetectionMethod = z.infer<typeof DetectionMethodSchema>;

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

export const DetectionEventSchema = z.object({
  id: z.string(),
  method: DetectionMethodSchema,
  bookId: z.string(),
  chapter: z.number(),
  verse: z.number(),
  endVerse: z.number().optional(),
  confidence: z.number(),
  transcriptSnippet: z.string(),
  rawMatch: z.string(),
  referenceLabel: z.string(),
  translationId: z.string(),
  verseText: z.string().nullable(),
  suppressed: z.boolean(),
  createdAt: z.string(),
});

export type DetectionEventDto = z.infer<typeof DetectionEventSchema>;

export const SimulateTranscriptRequestSchema = z.object({
  text: z.string().min(1),
  translationId: z.string().optional(),
  resetContext: z.boolean().optional(),
});

export type SimulateTranscriptRequest = z.infer<typeof SimulateTranscriptRequestSchema>;

export const SimulateTranscriptResponseSchema = z.object({
  detections: z.array(DetectionEventSchema),
  suppressed: z.array(DetectionEventSchema),
  normalizedTranscript: z.string(),
  context: z.object({
    bookId: z.string().nullable(),
    chapter: z.number().nullable(),
    verse: z.number().nullable(),
    updatedAt: z.number(),
    expiresAt: z.number(),
  }),
});

export type SimulateTranscriptResponse = z.infer<typeof SimulateTranscriptResponseSchema>;
