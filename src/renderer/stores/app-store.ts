import { create } from "zustand";
import type {
  AppSettings,
  AppStatus,
  BibleSearchResult,
  BibleVerseDto,
  DetectionEventDto,
  SttCapabilitiesDto,
  SttStatusDto,
  TranscriptEventDto,
  TranslationInfo,
} from "@shared/schemas";
import type { BibleBookInfo } from "@shared/types/ipc";
import { APP_NAME, DEFAULT_SETTINGS } from "@shared/constants/app";
import { listInputDevices, startAudioCapture, type AudioCaptureHandle, type CapturedDevice } from "@/lib/audio-capture";

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
  sttCapabilities: SttCapabilitiesDto | null;
  sttStatus: SttStatusDto;
  sttDetail: string | null;
  interimTranscript: string;
  finalTranscripts: string[];
  audioDevices: CapturedDevice[];
  audioLevel: number;
  noInputWarning: boolean;
  isListening: boolean;
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
  refreshAudioDevices: () => Promise<void>;
  setInputDevice: (deviceId: string | null) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
}

function hasApi(): boolean {
  return typeof window !== "undefined" && typeof window.verseflow !== "undefined";
}

let captureHandle: AudioCaptureHandle | null = null;
let noInputTimer: ReturnType<typeof setTimeout> | null = null;
let eventUnsubs: Array<() => void> = [];

function clearNoInputTimer(): void {
  if (noInputTimer) {
    clearTimeout(noInputTimer);
    noInputTimer = null;
  }
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
  sttCapabilities: null,
  sttStatus: "unavailable",
  sttDetail: null,
  interimTranscript: "",
  finalTranscripts: [],
  audioDevices: [],
  audioLevel: 0,
  noInputWarning: false,
  isListening: false,

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
          sttCredentialsConfigured: false,
        },
        error: "Desktop bridge unavailable — open via Electron.",
      });
      return;
    }
    set({ loading: true, error: null });
    try {
      const [status, settings, translations, books, caps] = await Promise.all([
        window.verseflow.getStatus(),
        window.verseflow.getSettings(),
        window.verseflow.listTranslations(),
        window.verseflow.listBooks(),
        window.verseflow.getSttCapabilities(),
      ]);
      const selected =
        translations.find((t) => t.id === settings.bible.defaultTranslationId)?.id ??
        translations[0]?.id ??
        settings.bible.defaultTranslationId;

      eventUnsubs.forEach((u) => u());
      eventUnsubs = [
        window.verseflow.onSttStatus(({ status: st, detail }) => {
          set((s) => ({
            sttStatus: st,
            sttDetail: detail ?? null,
            status: s.status ? { ...s.status, sttStatus: st } : s.status,
            isListening: st === "listening" || st === "reconnecting",
          }));
        }),
        window.verseflow.onSttTranscript((ev: TranscriptEventDto) => {
          if (ev.isFinal) {
            set((s) => ({
              interimTranscript: "",
              finalTranscripts: [ev.text, ...s.finalTranscripts].slice(0, 40),
              simulationLog: [`🎤 ${ev.text}`, ...s.simulationLog].slice(0, 40),
            }));
          } else {
            set({ interimTranscript: ev.text });
          }
        }),
        window.verseflow.onSttDetections((payload) => {
          set((s) => ({
            detections: [...payload.detections, ...s.detections].slice(0, 50),
            suppressedCount: s.suppressedCount + payload.suppressed.length,
            detectionContext: {
              bookId: payload.context.bookId,
              chapter: payload.context.chapter,
              verse: payload.context.verse,
            },
          }));
          if (payload.detections[0]) {
            void get().loadDetectionToPreview(payload.detections[0]);
          }
        }),
        window.verseflow.onSttError(({ message }) => {
          set({ sttDetail: message });
        }),
      ];

      set({
        status,
        settings,
        translations,
        books,
        selectedTranslationId: selected,
        sttCapabilities: caps,
        sttStatus: status.sttStatus,
        loading: false,
      });
      await get().refreshAudioDevices();
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
    set({ status, sttStatus: status.sttStatus });
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
      finalTranscripts: [],
      interimTranscript: "",
    });
  },

  refreshAudioDevices: async () => {
    try {
      const devices = await listInputDevices();
      set({ audioDevices: devices });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to list audio devices",
      });
    }
  },

  setInputDevice: async (deviceId) => {
    const { settings } = get();
    await get().updateSettings({
      ...settings,
      audio: { ...settings.audio, inputDeviceId: deviceId },
    });
  },

  startListening: async () => {
    if (!hasApi()) {
      set({ error: "Listening requires the Electron bridge." });
      return;
    }
    const { settings } = get();
    const start = await window.verseflow.startListening({
      languageMode: settings.general.languageMode,
      sampleRateHertz: settings.transcription.sampleRateHertz,
    });
    if (!start.ok) {
      set({
        sttStatus: start.status,
        sttDetail: start.error ?? "Failed to start listening",
        error: start.error ?? null,
      });
      return;
    }

    try {
      captureHandle?.stop();
      clearNoInputTimer();
      const warnMs = settings.audio.noInputWarningMs;
      captureHandle = await startAudioCapture({
        deviceId: settings.audio.inputDeviceId,
        onLevel: (level) => {
          set({ audioLevel: level });
          if (level > 0.01) {
            clearNoInputTimer();
            set({ noInputWarning: false });
          } else if (!noInputTimer) {
            noInputTimer = setTimeout(() => {
              set({ noInputWarning: true });
            }, warnMs);
          }
        },
        onPcm: (pcm) => {
          void window.verseflow.pushAudio(pcm);
        },
      });
      set({ isListening: true, sttStatus: "listening", error: null, noInputWarning: false });
    } catch (err) {
      await window.verseflow.stopListening();
      set({
        error: err instanceof Error ? err.message : "Microphone access failed",
        isListening: false,
        sttStatus: "error",
      });
    }
  },

  stopListening: async () => {
    clearNoInputTimer();
    captureHandle?.stop();
    captureHandle = null;
    if (hasApi()) await window.verseflow.stopListening();
    set({
      isListening: false,
      audioLevel: 0,
      noInputWarning: false,
      interimTranscript: "",
      sttStatus: get().sttCapabilities?.credentialsConfigured ? "idle" : "unavailable",
    });
  },
}));
