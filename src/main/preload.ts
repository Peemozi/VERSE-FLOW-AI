import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  HistoryExportFormat,
  DiagnoseTranscriptRequest,
  LiveScripturePayloadDto,
  RecordOperatorEventRequest,
  SimulateTranscriptRequest,
  SttStatusDto,
  TranscriptEventDto,
  VerseRef,
} from "../shared/schemas";
import {
  IpcChannels,
  IpcEvents,
  type SttDetectionsEvent,
  type SttStartRequest,
  type VerseFlowApi,
} from "../shared/types/ipc";

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: VerseFlowApi = {
  getStatus: () => ipcRenderer.invoke(IpcChannels.APP_GET_STATUS),
  getSettings: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET),
  setSettings: (settings: AppSettings) => ipcRenderer.invoke(IpcChannels.SETTINGS_SET, settings),
  listTranslations: () => ipcRenderer.invoke(IpcChannels.BIBLE_LIST_TRANSLATIONS),
  listBooks: () => ipcRenderer.invoke(IpcChannels.BIBLE_LIST_BOOKS),
  getVerse: (args: { translationId: string; ref: VerseRef }) =>
    ipcRenderer.invoke(IpcChannels.BIBLE_GET_VERSE, args),
  searchBible: (args: { translationId: string; query: string; limit?: number }) =>
    ipcRenderer.invoke(IpcChannels.BIBLE_SEARCH, args),
  simulateTranscript: (args: SimulateTranscriptRequest) =>
    ipcRenderer.invoke(IpcChannels.DETECTION_SIMULATE, args),
  resetDetection: () => ipcRenderer.invoke(IpcChannels.DETECTION_RESET),
  diagnoseTranscript: (args: DiagnoseTranscriptRequest) =>
    ipcRenderer.invoke(IpcChannels.DETECTION_DIAGNOSE, args),
  getSttCapabilities: () => ipcRenderer.invoke(IpcChannels.STT_GET_CAPABILITIES),
  startListening: (args: SttStartRequest) => ipcRenderer.invoke(IpcChannels.STT_START, args),
  stopListening: () => ipcRenderer.invoke(IpcChannels.STT_STOP),
  pushAudio: async (pcm: ArrayBuffer) => {
    await ipcRenderer.invoke(IpcChannels.STT_PUSH_AUDIO, Buffer.from(pcm));
  },
  listHistory: (limit) => ipcRenderer.invoke(IpcChannels.HISTORY_LIST, limit),
  recordHistory: (event: RecordOperatorEventRequest) =>
    ipcRenderer.invoke(IpcChannels.HISTORY_RECORD, event),
  exportHistory: (format: HistoryExportFormat) =>
    ipcRenderer.invoke(IpcChannels.HISTORY_EXPORT, format),
  endHistorySession: () => ipcRenderer.invoke(IpcChannels.HISTORY_END_SESSION),
  testVmixConnection: () => ipcRenderer.invoke(IpcChannels.VMIX_TEST_CONNECTION),
  connectVmix: () => ipcRenderer.invoke(IpcChannels.VMIX_CONNECT),
  sendLiveOutput: (payload: LiveScripturePayloadDto) =>
    ipcRenderer.invoke(IpcChannels.OUTPUT_SEND_LIVE, payload),
  clearLiveOutput: () => ipcRenderer.invoke(IpcChannels.OUTPUT_CLEAR_LIVE),
  getOverlayInfo: () => ipcRenderer.invoke(IpcChannels.OUTPUT_GET_OVERLAY_INFO),
  restartOverlay: () => ipcRenderer.invoke(IpcChannels.OUTPUT_RESTART_OVERLAY),
  openOverlay: () => ipcRenderer.invoke(IpcChannels.OUTPUT_OPEN_OVERLAY),
  onSttStatus: (cb) =>
    subscribe<{ status: SttStatusDto; detail?: string }>(IpcEvents.STT_STATUS, cb),
  onSttTranscript: (cb) => subscribe<TranscriptEventDto>(IpcEvents.STT_TRANSCRIPT, cb),
  onSttDetections: (cb) => subscribe<SttDetectionsEvent>(IpcEvents.STT_DETECTIONS, cb),
  onSttError: (cb) =>
    subscribe<{ message: string; retryable: boolean }>(IpcEvents.STT_ERROR, cb),
  onVmixStatus: (cb) =>
    subscribe<{ status: "disconnected" | "connected" | "error"; detail?: string }>(
      IpcEvents.VMIX_STATUS,
      cb,
    ),
  onOverlayStatus: (cb) => subscribe(IpcEvents.OVERLAY_STATUS, cb),
  log: (level, message) => ipcRenderer.invoke(IpcChannels.LOG_WRITE, level, message),
};

contextBridge.exposeInMainWorld("verseflow", api);
