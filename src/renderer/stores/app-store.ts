import { create } from "zustand";
import type {
  AppSettings,
  AppStatus,
  BibleSearchResult,
  BibleVerseDto,
  DetectionEventDto,
  OperatorEventDto,
  SttCapabilitiesDto,
  SttStatusDto,
  TranscriptEventDto,
  TranslationInfo,
  YorubaDiagnosticDto,
} from "@shared/schemas";
import type { BibleBookInfo, OverlayStatusDto } from "@shared/types/ipc";
import { APP_NAME, DEFAULT_SETTINGS } from "@shared/constants/app";
import { shouldAutoLive } from "@shared/operator/workflow";
import { listInputDevices, startAudioCapture, type AudioCaptureHandle, type CapturedDevice } from "@/lib/audio-capture";

export type AppView = "dashboard" | "history" | "diagnostics";

interface AppState {
  status: AppStatus | null;
  settings: AppSettings;
  translations: TranslationInfo[];
  books: BibleBookInfo[];
  preview: BibleVerseDto | null;
  live: BibleVerseDto | null;
  queue: BibleVerseDto[];
  searchResults: BibleSearchResult[];
  searchQuery: string;
  selectedTranslationId: string;
  selectedDetectionIndex: number;
  loading: boolean;
  error: string | null;
  view: AppView;
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
  history: OperatorEventDto[];
  vmixDetail: string | null;
  overlayUrl: string | null;
  overlayStatus: OverlayStatusDto | null;
  diagnosticsText: string;
  diagnosticsResult: YorubaDiagnosticDto | null;
  diagnosticsLoading: boolean;
  bootstrap: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  setView: (view: AppView) => void;
  setSearchQuery: (q: string) => void;
  setSelectedTranslation: (id: string) => void;
  setSelectedDetectionIndex: (index: number) => void;
  runSearch: () => Promise<void>;
  loadVerseToPreview: (result: BibleSearchResult) => Promise<void>;
  loadDetectionToPreview: (detection: DetectionEventDto) => Promise<void>;
  ingestDetections: (detections: DetectionEventDto[], suppressedCount?: number) => Promise<void>;
  sendPreviewToLive: () => Promise<void>;
  clearLive: () => Promise<void>;
  enqueuePreview: () => Promise<void>;
  removeFromQueue: (index: number) => void;
  liveFromQueueHead: () => Promise<void>;
  liveFromQueueOrPreview: () => Promise<void>;
  selectPrevDetection: () => void;
  selectNextDetection: () => void;
  detectionToPreview: () => Promise<void>;
  setSimulationText: (text: string) => void;
  runSimulation: (opts?: { resetContext?: boolean }) => Promise<void>;
  resetDetection: () => Promise<void>;
  refreshAudioDevices: () => Promise<void>;
  setInputDevice: (deviceId: string | null) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  exportHistory: (format: "csv" | "json") => Promise<void>;
  endHistorySession: () => Promise<void>;
  focusBibleSearch: () => void;
  testVmixConnection: () => Promise<void>;
  connectVmix: () => Promise<void>;
  refreshOverlayStatus: () => Promise<void>;
  restartOverlay: () => Promise<void>;
  openOverlay: () => Promise<void>;
  copyOverlayUrl: () => Promise<void>;
  sendTestVerse: (payload: {
    referenceLabel: string;
    verseText: string;
    translationId: string;
  }) => Promise<{ overlayOk: boolean; errors: string[] }>;
  setDiagnosticsText: (text: string) => void;
  runDiagnostics: () => Promise<void>;
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

async function recordHistorySafe(
  event: Parameters<NonNullable<Window["verseflow"]>["recordHistory"]>[0],
): Promise<void> {
  if (!hasApi()) return;
  try {
    await window.verseflow.recordHistory(event);
  } catch {
    // history must never break operator flow
  }
}

function verseToLivePayload(verse: BibleVerseDto) {
  return {
    referenceLabel: verse.referenceLabel,
    verseText: verse.originalText,
    translationId: verse.translationId,
    bookId: verse.bookId,
    chapter: verse.chapter,
    verse: verse.verse,
  };
}

async function buildLivePayload(
  verse: BibleVerseDto,
  settings: AppSettings,
): Promise<ReturnType<typeof verseToLivePayload> & {
  secondaryReferenceLabel?: string;
  secondaryVerseText?: string;
  secondaryTranslationId?: string;
}> {
  const base = verseToLivePayload(verse);
  const secondaryId = settings.bible.secondaryTranslationId;
  if (!secondaryId || secondaryId === verse.translationId || !hasApi()) {
    return base;
  }
  try {
    const secondary = await window.verseflow.getVerse({
      translationId: secondaryId,
      ref: { bookId: verse.bookId, chapter: verse.chapter, verse: verse.verse },
    });
    if (!secondary) return base;
    return {
      ...base,
      secondaryReferenceLabel: secondary.referenceLabel,
      secondaryVerseText: secondary.originalText,
      secondaryTranslationId: secondary.translationId,
    };
  } catch {
    return base;
  }
}

function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const useAppStore = create<AppState>((set, get) => ({
  status: null,
  settings: structuredClone(DEFAULT_SETTINGS),
  translations: [],
  books: [],
  preview: null,
  live: null,
  queue: [],
  searchResults: [],
  searchQuery: "",
  selectedTranslationId: DEFAULT_SETTINGS.bible.defaultTranslationId,
  selectedDetectionIndex: 0,
  loading: false,
  error: null,
  view: "dashboard",
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
  history: [],
  vmixDetail: null,
  overlayUrl: null,
  overlayStatus: null,
  diagnosticsText: "Johanu ori meta ese merindilogun",
  diagnosticsResult: null,
  diagnosticsLoading: false,

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
          set({
            detectionContext: {
              bookId: payload.context.bookId,
              chapter: payload.context.chapter,
              verse: payload.context.verse,
            },
          });
          void get().ingestDetections(payload.detections, payload.suppressed.length);
        }),
        window.verseflow.onSttError(({ message }) => {
          set({ sttDetail: message });
        }),
        window.verseflow.onVmixStatus(({ status: vs, detail }) => {
          set((s) => ({
            status: s.status
              ? { ...s.status, vmixStatus: vs, overlayUrl: s.status.overlayUrl }
              : s.status,
            vmixDetail: detail ?? null,
          }));
        }),
        window.verseflow.onOverlayStatus((snap) => {
          set((s) => ({
            overlayStatus: snap,
            overlayUrl: snap.url,
            status: s.status
              ? { ...s.status, overlayUrl: snap.url, overlayListening: snap.listening }
              : s.status,
            settings: snap.remapped
              ? {
                  ...s.settings,
                  output: { ...s.settings.output, overlayPort: snap.port },
                }
              : s.settings,
          }));
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
        overlayUrl: status.overlayUrl ?? null,
        loading: false,
      });
      await get().refreshAudioDevices();
      await get().refreshHistory();
      await get().refreshOverlayStatus();
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
    await get().refreshOverlayStatus();
  },

  setView: (view) => {
    set({ view });
    if (view === "history") void get().refreshHistory();
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedTranslation: (id) => set({ selectedTranslationId: id }),
  setSelectedDetectionIndex: (index) => set({ selectedDetectionIndex: Math.max(0, index) }),

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
    await recordHistorySafe({
      kind: "manual_search",
      notes: searchQuery.slice(0, 200),
      translationId: selectedTranslationId,
    });
  },

  loadVerseToPreview: async (result) => {
    let verse: BibleVerseDto | null = {
      translationId: result.translationId,
      bookId: result.bookId,
      chapter: result.chapter,
      verse: result.verse,
      originalText: result.originalText,
      referenceLabel: result.referenceLabel,
    };
    if (hasApi()) {
      verse = await window.verseflow.getVerse({
        translationId: result.translationId,
        ref: { bookId: result.bookId, chapter: result.chapter, verse: result.verse },
      });
    }
    set({ preview: verse });
    if (verse) {
      await recordHistorySafe({
        kind: "preview",
        bookId: verse.bookId,
        chapter: verse.chapter,
        verse: verse.verse,
        referenceLabel: verse.referenceLabel,
        translationId: verse.translationId,
        verseText: verse.originalText,
        method: "manual",
      });
    }
  },

  loadDetectionToPreview: async (detection) => {
    const verse: BibleVerseDto = detection.verseText
      ? {
          translationId: detection.translationId,
          bookId: detection.bookId,
          chapter: detection.chapter,
          verse: detection.verse,
          originalText: detection.verseText,
          referenceLabel: detection.referenceLabel,
        }
      : ((hasApi()
          ? await window.verseflow.getVerse({
              translationId: detection.translationId,
              ref: {
                bookId: detection.bookId,
                chapter: detection.chapter,
                verse: detection.verse,
              },
            })
          : null) ?? {
          translationId: detection.translationId,
          bookId: detection.bookId,
          chapter: detection.chapter,
          verse: detection.verse,
          originalText: "",
          referenceLabel: detection.referenceLabel,
        });

    set({ preview: verse });
    await recordHistorySafe({
      kind: "preview",
      bookId: verse.bookId,
      chapter: verse.chapter,
      verse: verse.verse,
      endVerse: detection.endVerse ?? null,
      referenceLabel: verse.referenceLabel,
      translationId: verse.translationId,
      verseText: verse.originalText,
      confidence: detection.confidence,
      method: detection.method,
    });
  },

  ingestDetections: async (incoming, suppressedAdd = 0) => {
    if (incoming.length === 0 && suppressedAdd === 0) return;
    const { settings } = get();
    set((s) => ({
      detections: [...incoming, ...s.detections].slice(0, 50),
      suppressedCount: s.suppressedCount + suppressedAdd,
      selectedDetectionIndex: 0,
    }));

    for (const d of incoming) {
      await recordHistorySafe({
        kind: "detection",
        bookId: d.bookId,
        chapter: d.chapter,
        verse: d.verse,
        endVerse: d.endVerse ?? null,
        referenceLabel: d.referenceLabel,
        translationId: d.translationId,
        verseText: d.verseText,
        confidence: d.confidence,
        method: d.method,
      });
    }

    const top = incoming[0];
    if (!top) return;

    if (shouldAutoLive(settings.detection.mode, top.confidence, settings.detection.minConfidence, {
      method: top.method,
      quotationMinConfidence: settings.detection.quotationMinConfidence,
    })) {
      await get().loadDetectionToPreview(top);
      await get().sendPreviewToLive();
    } else {
      await get().loadDetectionToPreview(top);
    }
  },

  sendPreviewToLive: async () => {
    const { preview, settings } = get();
    if (!preview) return;
    set({ live: preview });
    if (hasApi()) {
      try {
        const payload = await buildLivePayload(preview, settings);
        const result = await window.verseflow.sendLiveOutput(payload);
        if (result.errors.length) {
          set({ error: result.errors.join("; ") });
        }
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    await recordHistorySafe({
      kind: "live",
      bookId: preview.bookId,
      chapter: preview.chapter,
      verse: preview.verse,
      referenceLabel: preview.referenceLabel,
      translationId: preview.translationId,
      verseText: preview.originalText,
    });
  },

  clearLive: async () => {
    const { live } = get();
    set({ live: null });
    if (hasApi()) {
      try {
        const result = await window.verseflow.clearLiveOutput();
        if (result.errors.length) {
          set({ error: result.errors.join("; ") });
        }
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    await recordHistorySafe({
      kind: "clear_live",
      bookId: live?.bookId ?? null,
      chapter: live?.chapter ?? null,
      verse: live?.verse ?? null,
      referenceLabel: live?.referenceLabel ?? null,
      translationId: live?.translationId ?? null,
      notes: live ? "cleared" : "clear with empty live",
    });
  },

  enqueuePreview: async () => {
    const { preview, queue } = get();
    if (!preview) return;
    set({ queue: [...queue, preview] });
    await recordHistorySafe({
      kind: "queue_add",
      bookId: preview.bookId,
      chapter: preview.chapter,
      verse: preview.verse,
      referenceLabel: preview.referenceLabel,
      translationId: preview.translationId,
      verseText: preview.originalText,
    });
  },

  removeFromQueue: (index) => {
    set((s) => ({ queue: s.queue.filter((_, i) => i !== index) }));
  },

  liveFromQueueHead: async () => {
    const { queue, settings } = get();
    if (queue.length === 0) return;
    const [head, ...rest] = queue;
    set({ queue: rest, live: head, preview: head });
    if (hasApi()) {
      try {
        const payload = await buildLivePayload(head, settings);
        const result = await window.verseflow.sendLiveOutput(payload);
        if (result.errors.length) {
          set({ error: result.errors.join("; ") });
        }
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    }
    await recordHistorySafe({
      kind: "live",
      bookId: head.bookId,
      chapter: head.chapter,
      verse: head.verse,
      referenceLabel: head.referenceLabel,
      translationId: head.translationId,
      verseText: head.originalText,
      notes: "from_queue",
    });
  },

  liveFromQueueOrPreview: async () => {
    if (get().queue.length > 0) {
      await get().liveFromQueueHead();
    } else {
      await get().sendPreviewToLive();
    }
  },

  selectPrevDetection: () => {
    set((s) => ({
      selectedDetectionIndex: Math.max(0, s.selectedDetectionIndex - 1),
    }));
  },

  selectNextDetection: () => {
    set((s) => ({
      selectedDetectionIndex: Math.min(
        Math.max(0, s.detections.length - 1),
        s.selectedDetectionIndex + 1,
      ),
    }));
  },

  detectionToPreview: async () => {
    const { detections, selectedDetectionIndex } = get();
    const d = detections[selectedDetectionIndex];
    if (d) await get().loadDetectionToPreview(d);
  },

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
      detectionContext: {
        bookId: result.context.bookId,
        chapter: result.context.chapter,
        verse: result.context.verse,
      },
      simulationLog: [`→ ${text}`, ...simulationLog].slice(0, 40),
      simulationText: "",
    });
    await get().ingestDetections(result.detections, result.suppressed.length);
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
      selectedDetectionIndex: 0,
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

  refreshHistory: async () => {
    if (!hasApi()) return;
    const history = await window.verseflow.listHistory(200);
    set({ history });
  },

  exportHistory: async (format) => {
    if (!hasApi()) return;
    const { filename, content } = await window.verseflow.exportHistory(format);
    downloadTextFile(
      filename,
      content,
      format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
    );
  },

  endHistorySession: async () => {
    if (!hasApi()) return;
    await window.verseflow.endHistorySession();
    await get().refreshHistory();
  },

  focusBibleSearch: () => {
    set({ view: "dashboard" });
    queueMicrotask(() => {
      document.getElementById("bible-search-input")?.focus();
    });
  },

  testVmixConnection: async () => {
    if (!hasApi()) return;
    try {
      const result = await window.verseflow.testVmixConnection();
      set((s) => ({
        vmixDetail: result.detail,
        status: s.status
          ? {
              ...s.status,
              vmixStatus: result.ok ? "connected" : "error",
            }
          : s.status,
        error: result.ok ? null : result.detail,
      }));
    } catch (err) {
      set({
        vmixDetail: err instanceof Error ? err.message : String(err),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  connectVmix: async () => {
    if (!hasApi()) return;
    try {
      const result = await window.verseflow.connectVmix();
      set((s) => ({
        status: s.status ? { ...s.status, vmixStatus: result.status as "disconnected" | "connected" | "error" } : s.status,
        vmixDetail: result.detail ?? null,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  refreshOverlayStatus: async () => {
    if (!hasApi()) return;
    try {
      const snap = await window.verseflow.getOverlayInfo();
      set((s) => ({
        overlayStatus: snap,
        overlayUrl: snap.url,
        status: s.status
          ? { ...s.status, overlayUrl: snap.url, overlayListening: snap.listening }
          : s.status,
        settings: snap.remapped
          ? { ...s.settings, output: { ...s.settings.output, overlayPort: snap.port } }
          : s.settings,
      }));
    } catch {
      /* optional before overlay ready */
    }
  },

  restartOverlay: async () => {
    if (!hasApi()) return;
    try {
      const snap = await window.verseflow.restartOverlay();
      const settings = await window.verseflow.getSettings();
      set((s) => ({
        settings,
        overlayStatus: snap,
        overlayUrl: snap.url,
        status: s.status
          ? { ...s.status, overlayUrl: snap.url, overlayListening: snap.listening }
          : s.status,
        error: snap.error && snap.status === "error" ? snap.error : null,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  openOverlay: async () => {
    if (!hasApi()) return;
    try {
      const result = await window.verseflow.openOverlay();
      if (!result.ok) {
        set({ error: result.error ?? "Could not open overlay URL" });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  copyOverlayUrl: async () => {
    const url =
      get().overlayStatus?.url ??
      get().overlayUrl ??
      `http://127.0.0.1:${get().settings.output.overlayPort}/overlay`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Clipboard copy failed" });
    }
  },

  sendTestVerse: async (payload) => {
    if (!hasApi()) {
      return { overlayOk: false, errors: ["Desktop bridge unavailable"] };
    }
    const result = await window.verseflow.sendLiveOutput(payload);
    await get().refreshOverlayStatus();
    if (!result.overlayOk) {
      set({ error: result.errors.join("; ") || "Overlay test send failed" });
    } else {
      set({ error: null });
    }
    return { overlayOk: result.overlayOk, errors: result.errors };
  },

  setDiagnosticsText: (text) => set({ diagnosticsText: text }),

  runDiagnostics: async () => {
    if (!hasApi()) return;
    const text = get().diagnosticsText.trim();
    if (!text) return;
    set({ diagnosticsLoading: true });
    try {
      const result = await window.verseflow.diagnoseTranscript({
        text,
        languages: ["yo", "en"],
        numberLanguage: "yo",
      });
      set({ diagnosticsResult: result, diagnosticsLoading: false });
    } catch (err) {
      set({
        diagnosticsLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
}));
