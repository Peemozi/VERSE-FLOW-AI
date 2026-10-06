import type {
  AppSettings,
  AppStatus,
  BibleSearchResult,
  BibleVerseDto,
  DetectionEventDto,
  HistoryExportFormatSchema,
  LanguageMode,
  LiveScripturePayloadDto,
  OperatorEventDto,
  OutputSendResult,
  RecordOperatorEventRequest,
  SimulateTranscriptRequest,
  SimulateTranscriptResponse,
  SttCapabilitiesDto,
  SttStatusDto,
  TranscriptEventDto,
  TranslationInfo,
  VerseRef,
  VmixConnectionTestResult,
} from "../schemas";
import type { z } from "zod";

/** Typed IPC channel names — keep in sync with preload + main handlers. */
export const IpcChannels = {
  APP_GET_STATUS: "app:getStatus",
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",
  BIBLE_LIST_TRANSLATIONS: "bible:listTranslations",
  BIBLE_LIST_BOOKS: "bible:listBooks",
  BIBLE_GET_VERSE: "bible:getVerse",
  BIBLE_SEARCH: "bible:search",
  DETECTION_SIMULATE: "detection:simulate",
  DETECTION_RESET: "detection:reset",
  STT_GET_CAPABILITIES: "stt:getCapabilities",
  STT_START: "stt:start",
  STT_STOP: "stt:stop",
  STT_PUSH_AUDIO: "stt:pushAudio",
  HISTORY_LIST: "history:list",
  HISTORY_RECORD: "history:record",
  HISTORY_EXPORT: "history:export",
  HISTORY_END_SESSION: "history:endSession",
  VMIX_TEST_CONNECTION: "vmix:testConnection",
  VMIX_CONNECT: "vmix:connect",
  OUTPUT_SEND_LIVE: "output:sendLive",
  OUTPUT_CLEAR_LIVE: "output:clearLive",
  OUTPUT_GET_OVERLAY_INFO: "output:getOverlayInfo",
  LOG_WRITE: "log:write",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/** Main → renderer push events */
export const IpcEvents = {
  STT_STATUS: "stt:event:status",
  STT_TRANSCRIPT: "stt:event:transcript",
  STT_DETECTIONS: "stt:event:detections",
  STT_ERROR: "stt:event:error",
  VMIX_STATUS: "vmix:event:status",
} as const;

export interface BibleBookInfo {
  id: string;
  nameEn: string;
  order: number;
  chapters: number;
  testament: string;
}

export interface SttStartRequest {
  languageMode: LanguageMode;
  sampleRateHertz?: number;
}

export interface SttStartResponse {
  ok: boolean;
  status: SttStatusDto;
  error?: string;
}

export interface SttDetectionsEvent {
  source: string;
  transcript: string;
  detections: DetectionEventDto[];
  suppressed: DetectionEventDto[];
  context: {
    bookId: string | null;
    chapter: number | null;
    verse: number | null;
    updatedAt: number;
    expiresAt: number;
  };
}

export type HistoryExportFormat = z.infer<typeof HistoryExportFormatSchema>;

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
  simulateTranscript: (args: SimulateTranscriptRequest) => Promise<SimulateTranscriptResponse>;
  resetDetection: () => Promise<void>;
  getSttCapabilities: () => Promise<SttCapabilitiesDto>;
  startListening: (args: SttStartRequest) => Promise<SttStartResponse>;
  stopListening: () => Promise<void>;
  pushAudio: (pcm: ArrayBuffer) => Promise<void>;
  listHistory: (limit?: number) => Promise<OperatorEventDto[]>;
  recordHistory: (event: RecordOperatorEventRequest) => Promise<OperatorEventDto>;
  exportHistory: (format: HistoryExportFormat) => Promise<{ filename: string; content: string }>;
  endHistorySession: () => Promise<void>;
  testVmixConnection: () => Promise<VmixConnectionTestResult>;
  connectVmix: () => Promise<{ status: string; detail?: string }>;
  sendLiveOutput: (payload: LiveScripturePayloadDto) => Promise<OutputSendResult>;
  clearLiveOutput: () => Promise<OutputSendResult>;
  getOverlayInfo: () => Promise<{ url: string; listening: boolean; theme: string }>;
  onSttStatus: (cb: (payload: { status: SttStatusDto; detail?: string }) => void) => () => void;
  onSttTranscript: (cb: (payload: TranscriptEventDto) => void) => () => void;
  onSttDetections: (cb: (payload: SttDetectionsEvent) => void) => () => void;
  onSttError: (cb: (payload: { message: string; retryable: boolean }) => void) => () => void;
  onVmixStatus: (
    cb: (payload: { status: "disconnected" | "connected" | "error"; detail?: string }) => void,
  ) => () => void;
  log: (level: "debug" | "info" | "warn" | "error", message: string) => Promise<void>;
}

declare global {
  interface Window {
    verseflow: VerseFlowApi;
  }
}

export {};
