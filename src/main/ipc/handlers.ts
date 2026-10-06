import { ipcMain } from "electron";
import { APP_NAME, APP_VERSION } from "../../shared/constants/app";
import { AppSettingsSchema, SimulateTranscriptRequestSchema } from "../../shared/schemas";
import { IpcChannels } from "../../shared/types/ipc";
import { getDatabase } from "../database/connection";
import { BibleRepository } from "../database/BibleRepository";
import { loadSettings, saveSettings } from "../settings/store";
import { logger } from "../security/logger";
import { getScriptureDetector, resetScriptureDetector } from "../scripture/detectorService";

function bibleRepo(): BibleRepository {
  const db = getDatabase();
  const repo = new BibleRepository(db);
  repo.seedCanonicalBooks();
  return repo;
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.APP_GET_STATUS, () => {
    const repo = bibleRepo();
    const translations = repo.listTranslations();
    const bibleReady = translations.some((t) => t.verseCount > 0);
    return {
      appName: APP_NAME,
      version: APP_VERSION,
      dbReady: true,
      bibleReady,
      sttStatus: "unavailable" as const,
      vmixStatus: "disconnected" as const,
    };
  });

  ipcMain.handle(IpcChannels.SETTINGS_GET, () => loadSettings());

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_event, payload: unknown) => {
    const parsed = AppSettingsSchema.parse(payload);
    const saved = saveSettings(parsed);
    // Recreate detector so language / translation preferences apply
    resetScriptureDetector();
    return saved;
  });

  ipcMain.handle(IpcChannels.BIBLE_LIST_TRANSLATIONS, () => bibleRepo().listTranslations());

  ipcMain.handle(IpcChannels.BIBLE_LIST_BOOKS, () => bibleRepo().listBooks());

  ipcMain.handle(
    IpcChannels.BIBLE_GET_VERSE,
    (
      _event,
      args: { translationId: string; ref: { bookId: string; chapter: number; verse: number } },
    ) => {
      const { translationId, ref } = args;
      return bibleRepo().getVerse(translationId, ref.bookId, ref.chapter, ref.verse);
    },
  );

  ipcMain.handle(
    IpcChannels.BIBLE_SEARCH,
    (_event, args: { translationId: string; query: string; limit?: number }) => {
      return bibleRepo().search(args.translationId, args.query, args.limit ?? 25);
    },
  );

  ipcMain.handle(IpcChannels.DETECTION_SIMULATE, (_event, payload: unknown) => {
    const req = SimulateTranscriptRequestSchema.parse(payload);
    const detector = getScriptureDetector();
    if (req.resetContext) detector.reset();
    if (req.translationId) detector.setTranslationId(req.translationId);
    const result = detector.processTranscript(req.text);
    logger.info("Simulation transcript processed", {
      detections: result.detections.length,
      suppressed: result.suppressed.length,
    });
    return result;
  });

  ipcMain.handle(IpcChannels.DETECTION_RESET, () => {
    resetScriptureDetector();
  });

  ipcMain.handle(
    IpcChannels.LOG_WRITE,
    (_event, level: "debug" | "info" | "warn" | "error", message: string) => {
      logger[level](message, { source: "renderer" });
    },
  );

  logger.info("IPC handlers registered");
}
