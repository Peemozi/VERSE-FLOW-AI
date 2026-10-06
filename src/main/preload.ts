import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, SimulateTranscriptRequest, VerseRef } from "../shared/schemas";
import { IpcChannels, type VerseFlowApi } from "../shared/types/ipc";

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
  log: (level, message) => ipcRenderer.invoke(IpcChannels.LOG_WRITE, level, message),
};

contextBridge.exposeInMainWorld("verseflow", api);
