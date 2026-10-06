import { ipcMain } from "electron";
import { z } from "zod";
import { APP_NAME, APP_VERSION } from "../../shared/constants/app";
import {
  AppSettingsSchema,
  HistoryExportFormatSchema,
  LanguageModeSchema,
  LiveScripturePayloadSchema,
  RecordOperatorEventSchema,
  SimulateTranscriptRequestSchema,
} from "../../shared/schemas";
import { IpcChannels } from "../../shared/types/ipc";
import { getDatabase } from "../database/connection";
import { BibleRepository } from "../database/BibleRepository";
import { loadSettings, saveSettings } from "../settings/store";
import { logger } from "../security/logger";
import { getScriptureDetector, resetScriptureDetector } from "../scripture/detectorService";
import { getLiveSession } from "../transcription/LiveSessionController";
import { GoogleCloudSpeechProvider } from "../transcription/GoogleCloudSpeechProvider";
import { getSessionHistory } from "../sessions";
import { exportHistoryCsv, exportHistoryJson } from "../../shared/operator/workflow";
import { getOutputController } from "../vmix/OutputController";

function bibleRepo(): BibleRepository {
  const db = getDatabase();
  const repo = new BibleRepository(db);
  repo.seedCanonicalBooks();
  return repo;
}

const SttStartSchema = z.object({
  languageMode: LanguageModeSchema,
  sampleRateHertz: z.number().int().positive().optional(),
});

function mapVmixUiStatus(
  status: string,
): "disconnected" | "connected" | "error" {
  if (status === "connected") return "connected";
  if (status === "error" || status === "reconnecting") return "error";
  return "disconnected";
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.APP_GET_STATUS, () => {
    const repo = bibleRepo();
    const translations = repo.listTranslations();
    const bibleReady = translations.some((t) => t.verseCount > 0);
    const session = getLiveSession();
    const output = getOutputController();
    return {
      appName: APP_NAME,
      version: APP_VERSION,
      dbReady: true,
      bibleReady,
      sttStatus: session.getStatus(),
      vmixStatus: mapVmixUiStatus(output.getVmixStatus()),
      sttCredentialsConfigured: GoogleCloudSpeechProvider.credentialsConfigured(),
      overlayUrl: output.getOverlayUrl(),
      overlayListening: output.isOverlayListening(),
    };
  });

  ipcMain.handle(IpcChannels.SETTINGS_GET, () => loadSettings());

  ipcMain.handle(IpcChannels.SETTINGS_SET, async (_event, payload: unknown) => {
    const parsed = AppSettingsSchema.parse(payload);
    const saved = saveSettings(parsed);
    resetScriptureDetector();
    try {
      await getOutputController().applySettings(saved);
    } catch (err) {
      logger.warn("Failed to apply output settings", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
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

  ipcMain.handle(IpcChannels.STT_GET_CAPABILITIES, () => getLiveSession().getCapabilities());

  ipcMain.handle(IpcChannels.STT_START, async (_event, payload: unknown) => {
    const req = SttStartSchema.parse(payload);
    const settings = loadSettings();
    return getLiveSession().start({
      languageMode: req.languageMode ?? settings.general.languageMode,
      sampleRateHertz: req.sampleRateHertz ?? settings.transcription.sampleRateHertz,
    });
  });

  ipcMain.handle(IpcChannels.STT_STOP, async () => {
    await getLiveSession().stop();
  });

  ipcMain.handle(IpcChannels.STT_PUSH_AUDIO, (_event, payload: unknown) => {
    try {
      let buffer: Buffer;
      if (Buffer.isBuffer(payload)) {
        buffer = payload;
      } else if (payload instanceof Uint8Array) {
        buffer = Buffer.from(payload);
      } else if (payload && typeof payload === "object" && "data" in (payload as object)) {
        buffer = Buffer.from((payload as { data: number[] }).data);
      } else {
        return;
      }
      getLiveSession().pushAudio(buffer);
    } catch (err) {
      logger.warn("STT_PUSH_AUDIO failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  ipcMain.handle(IpcChannels.HISTORY_LIST, (_event, limit?: number) => {
    return getSessionHistory().list(typeof limit === "number" ? limit : 200);
  });

  ipcMain.handle(IpcChannels.HISTORY_RECORD, (_event, payload: unknown) => {
    const event = RecordOperatorEventSchema.parse(payload);
    const settings = loadSettings();
    return getSessionHistory().record(event, settings.general.languageMode);
  });

  ipcMain.handle(IpcChannels.HISTORY_EXPORT, (_event, format: unknown) => {
    const fmt = HistoryExportFormatSchema.parse(format);
    const rows = getSessionHistory().list(1000);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (fmt === "csv") {
      return {
        filename: `verseflow-history-${stamp}.csv`,
        content: exportHistoryCsv(rows),
      };
    }
    return {
      filename: `verseflow-history-${stamp}.json`,
      content: exportHistoryJson(rows),
    };
  });

  ipcMain.handle(IpcChannels.HISTORY_END_SESSION, () => {
    getSessionHistory().endSession();
  });

  ipcMain.handle(IpcChannels.VMIX_TEST_CONNECTION, async () => {
    return getOutputController().testConnection();
  });

  ipcMain.handle(IpcChannels.VMIX_CONNECT, async () => {
    const output = getOutputController();
    await output.connectVmix();
    return { status: mapVmixUiStatus(output.getVmixStatus()) };
  });

  ipcMain.handle(IpcChannels.OUTPUT_SEND_LIVE, async (_event, payload: unknown) => {
    const live = LiveScripturePayloadSchema.parse(payload);
    return getOutputController().sendLive(live);
  });

  ipcMain.handle(IpcChannels.OUTPUT_CLEAR_LIVE, async () => {
    return getOutputController().clearLive();
  });

  ipcMain.handle(IpcChannels.OUTPUT_GET_OVERLAY_INFO, () => {
    const output = getOutputController();
    const settings = loadSettings();
    return {
      url: output.getOverlayUrl(),
      listening: output.isOverlayListening(),
      theme: settings.output.overlayTheme,
    };
  });

  ipcMain.handle(
    IpcChannels.LOG_WRITE,
    (_event, level: "debug" | "info" | "warn" | "error", message: string) => {
      logger[level](message, { source: "renderer" });
    },
  );

  logger.info("IPC handlers registered");
}
