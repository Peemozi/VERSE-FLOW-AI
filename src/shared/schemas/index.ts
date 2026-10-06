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
  audio: z.object({
    inputDeviceId: z.string().nullable(),
    noInputWarningMs: z.number().int().positive(),
  }),
  transcription: z.object({
    provider: z.enum(["google", "unavailable"]),
    sampleRateHertz: z.number().int().positive(),
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
    /** vMix input name or number for the title */
    inputName: z.string().min(1),
    fieldReference: z.string().min(1),
    fieldVerse: z.string().min(1),
    fieldTranslation: z.string().min(1),
    /** Auto OverlayInputN In/Out on Send Live / Clear Live */
    autoOverlay: z.boolean(),
    overlayChannel: z.number().int().min(1).max(4),
  }),
  output: z.object({
    overlayEnabled: z.boolean(),
    overlayPort: z.number().int().positive(),
    overlayTheme: z.enum([
      "clean-lower-third",
      "full-scripture",
      "minimal",
      "bilingual",
    ]),
  }),
  appearance: z.object({
    theme: z.enum(["dark", "light"]),
  }),
  advanced: z.object({
    logLevel: z.enum(["debug", "info", "warn", "error"]),
  }),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

function deepMergeSettings(partial: Record<string, unknown>): AppSettings {
  const base = structuredClone(DEFAULT_SETTINGS) as AppSettings & Record<string, unknown>;
  for (const key of Object.keys(base)) {
    const incoming = partial[key];
    if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
      base[key as keyof AppSettings] = {
        ...(base[key as keyof AppSettings] as object),
        ...(incoming as object),
      } as never;
    }
  }
  return base as AppSettings;
}

export function parseSettings(input: unknown): AppSettings {
  const parsed = AppSettingsSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  if (input && typeof input === "object") {
    const merged = deepMergeSettings(input as Record<string, unknown>);
    const again = AppSettingsSchema.safeParse(merged);
    if (again.success) return again.data;
  }
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

export const SttStatusSchema = z.enum([
  "unavailable",
  "idle",
  "listening",
  "error",
  "reconnecting",
]);
export type SttStatusDto = z.infer<typeof SttStatusSchema>;

export const AppStatusSchema = z.object({
  appName: z.string(),
  version: z.string(),
  dbReady: z.boolean(),
  bibleReady: z.boolean(),
  sttStatus: SttStatusSchema,
  vmixStatus: z.enum(["disconnected", "connected", "error"]),
  sttCredentialsConfigured: z.boolean(),
  overlayUrl: z.string().optional(),
  overlayListening: z.boolean().optional(),
});

export type AppStatus = z.infer<typeof AppStatusSchema>;

export const OverlayThemeSchema = z.enum([
  "clean-lower-third",
  "full-scripture",
  "minimal",
  "bilingual",
]);
export type OverlayTheme = z.infer<typeof OverlayThemeSchema>;

export const LiveScripturePayloadSchema = z.object({
  referenceLabel: z.string(),
  verseText: z.string(),
  translationId: z.string(),
  bookId: z.string().optional(),
  chapter: z.number().optional(),
  verse: z.number().optional(),
  endVerse: z.number().optional(),
  secondaryReferenceLabel: z.string().optional(),
  secondaryVerseText: z.string().optional(),
  secondaryTranslationId: z.string().optional(),
});
export type LiveScripturePayloadDto = z.infer<typeof LiveScripturePayloadSchema>;

export const VmixConnectionTestResultSchema = z.object({
  ok: z.boolean(),
  detail: z.string(),
  httpOk: z.boolean().optional(),
  tcpOk: z.boolean().optional(),
});
export type VmixConnectionTestResult = z.infer<typeof VmixConnectionTestResultSchema>;

export const OutputSendResultSchema = z.object({
  vmixOk: z.boolean(),
  overlayOk: z.boolean(),
  errors: z.array(z.string()),
});
export type OutputSendResult = z.infer<typeof OutputSendResultSchema>;

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

export const TranscriptEventSchema = z.object({
  text: z.string(),
  isFinal: z.boolean(),
  stability: z.number().optional(),
  languageCode: z.string().optional(),
  receivedAt: z.string(),
});

export type TranscriptEventDto = z.infer<typeof TranscriptEventSchema>;

export const SttCapabilitiesSchema = z.object({
  providerId: z.string(),
  displayName: z.string(),
  streaming: z.boolean(),
  interimResults: z.boolean(),
  credentialsConfigured: z.boolean(),
  languageModes: z.record(
    z.object({
      supported: z.boolean(),
      languageCodes: z.array(z.string()),
      bilingualStrategy: z.enum(["unsupported", "alternative-language-codes"]).optional(),
      notes: z.string().optional(),
    }),
  ),
  futureProviders: z.array(z.string()),
});

export type SttCapabilitiesDto = z.infer<typeof SttCapabilitiesSchema>;

export const OperatorEventKindSchema = z.enum([
  "detection",
  "preview",
  "queue_add",
  "live",
  "clear_live",
  "manual_search",
]);

export const OperatorEventSchema = z.object({
  id: z.number(),
  sessionId: z.string(),
  kind: OperatorEventKindSchema,
  bookId: z.string().nullable(),
  chapter: z.number().nullable(),
  verse: z.number().nullable(),
  endVerse: z.number().nullable(),
  referenceLabel: z.string().nullable(),
  translationId: z.string().nullable(),
  verseText: z.string().nullable(),
  confidence: z.number().nullable(),
  method: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export type OperatorEventDto = z.infer<typeof OperatorEventSchema>;

export const RecordOperatorEventSchema = z.object({
  kind: OperatorEventKindSchema,
  bookId: z.string().nullable().optional(),
  chapter: z.number().nullable().optional(),
  verse: z.number().nullable().optional(),
  endVerse: z.number().nullable().optional(),
  referenceLabel: z.string().nullable().optional(),
  translationId: z.string().nullable().optional(),
  verseText: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  method: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type RecordOperatorEventRequest = z.infer<typeof RecordOperatorEventSchema>;

export const HistoryExportFormatSchema = z.enum(["csv", "json"]);
export type HistoryExportFormat = z.infer<typeof HistoryExportFormatSchema>;
