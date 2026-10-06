import type { AppSettings } from "../schemas";

/** Central app identity — change here to rename the product. */
export const APP_NAME = "VerseFlow AI" as const;
export const APP_ID = "verseflow-ai" as const;
export const APP_VERSION = "0.1.0" as const;

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    languageMode: "english",
    startMinimized: false,
  },
  audio: {
    inputDeviceId: null,
    noInputWarningMs: 4000,
  },
  transcription: {
    provider: "google",
    sampleRateHertz: 16000,
  },
  bible: {
    defaultTranslationId: "WEB",
    secondaryTranslationId: "OYCB",
  },
  detection: {
    mode: "assisted",
    minConfidence: 0.7,
    quotationMinConfidence: 0.9,
    quotationEnabled: true,
    quotationMinChars: 40,
    quotationMinWords: 6,
    semanticEnabled: false,
    semanticMinConfidence: 0.85,
  },
  vmix: {
    host: "127.0.0.1",
    httpPort: 8088,
    tcpPort: 8099,
    enabled: false,
    inputName: "Scripture",
    fieldReference: "Reference",
    fieldVerse: "Verse",
    fieldTranslation: "Translation",
    autoOverlay: false,
    overlayChannel: 1,
  },
  output: {
    overlayEnabled: true,
    overlayPort: 8791,
    overlayTheme: "clean-lower-third",
  },
  appearance: {
    theme: "dark",
  },
  advanced: {
    logLevel: "info",
  },
};

export type { AppSettings };
