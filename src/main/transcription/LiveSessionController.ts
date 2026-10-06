import type { BrowserWindow } from "electron";
import type { LanguageMode } from "../../shared/schemas";
import { logger } from "../security/logger";
import { getScriptureDetector } from "../scripture/detectorService";
import { createSpeechToTextProvider } from "./createProvider";
import { ReconnectBackoff } from "./reconnectBackoff";
import type {
  SpeechToTextProvider,
  SttCapabilities,
  SttStatus,
  TranscriptEvent,
} from "./SpeechToTextProvider";

export const SttIpcEvents = {
  STATUS: "stt:event:status",
  TRANSCRIPT: "stt:event:transcript",
  DETECTIONS: "stt:event:detections",
  ERROR: "stt:event:error",
} as const;

/**
 * Owns the live listen session: STT stream → finals → ScriptureDetector.
 * Never throws out of event handlers; reconnects with backoff on retryable errors.
 */
export class LiveSessionController {
  private provider: SpeechToTextProvider;
  private wantListening = false;
  private languageMode: LanguageMode = "english";
  private sampleRateHertz = 16000;
  private backoff = new ReconnectBackoff();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private window: BrowserWindow | null = null;
  private lastStatus: SttStatus = "unavailable";

  constructor(provider = createSpeechToTextProvider()) {
    this.provider = provider;
    this.lastStatus = provider.getStatus();
  }

  setWindow(win: BrowserWindow | null): void {
    this.window = win;
  }

  getCapabilities(): SttCapabilities {
    return this.provider.getCapabilities();
  }

  getStatus(): SttStatus {
    return this.lastStatus;
  }

  private broadcast(channel: string, payload: unknown): void {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(channel, payload);
      }
    } catch (err) {
      logger.warn("Failed to broadcast STT event", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private setStatus(status: SttStatus, detail?: string): void {
    this.lastStatus = status;
    this.broadcast(SttIpcEvents.STATUS, { status, detail, at: new Date().toISOString() });
  }

  async start(options: {
    languageMode: LanguageMode;
    sampleRateHertz?: number;
  }): Promise<{ ok: boolean; status: SttStatus; error?: string }> {
    this.wantListening = true;
    this.languageMode = options.languageMode;
    this.sampleRateHertz = options.sampleRateHertz ?? 16000;
    this.backoff.reset();
    this.clearReconnectTimer();

    try {
      await this.openStream();
      return { ok: true, status: this.lastStatus };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(this.provider.getCapabilities().credentialsConfigured ? "error" : "unavailable", message);
      return { ok: false, status: this.lastStatus, error: message };
    }
  }

  private async openStream(): Promise<void> {
    await this.provider.start({
      languageMode: this.languageMode,
      sampleRateHertz: this.sampleRateHertz,
      onTranscript: (event) => this.handleTranscript(event),
      onStatus: (status, detail) => this.setStatus(status, detail),
      onError: (message, retryable) => this.handleProviderError(message, retryable),
    });
    this.backoff.reset();
    this.setStatus("listening");
  }

  private handleTranscript(event: TranscriptEvent): void {
    this.broadcast(SttIpcEvents.TRANSCRIPT, event);
    if (!event.isFinal) return;
    const text = event.text.trim();
    if (!text) return;
    try {
      const detector = getScriptureDetector();
      const result = detector.processTranscript(text);
      this.broadcast(SttIpcEvents.DETECTIONS, {
        source: "live-stt",
        transcript: text,
        detections: result.detections,
        suppressed: result.suppressed,
        context: result.context,
      });
      // Semantic path is async and optional — never delays the broadcast above
      detector.scheduleSemanticSuggestions(text, result, (semantic) => {
        if (semantic.length === 0) return;
        this.broadcast(SttIpcEvents.DETECTIONS, {
          source: "semantic",
          transcript: text,
          detections: semantic,
          suppressed: [],
          context: result.context,
        });
      });
    } catch (err) {
      logger.warn("Detection after STT final failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private handleProviderError(message: string, retryable: boolean): void {
    this.broadcast(SttIpcEvents.ERROR, { message, retryable, at: new Date().toISOString() });
    if (!this.wantListening) {
      this.setStatus("error", message);
      return;
    }
    if (!retryable) {
      this.wantListening = false;
      this.setStatus("unavailable", message);
      return;
    }
    this.scheduleReconnect(message);
  }

  private scheduleReconnect(reason: string): void {
    this.clearReconnectTimer();
    const delay = this.backoff.nextDelayMs();
    this.setStatus("reconnecting", `${reason} · retry in ${delay}ms`);
    logger.info("Scheduling STT reconnect", { delay, attempt: this.backoff.getAttempt() });
    this.reconnectTimer = setTimeout(() => {
      void this.reconnect();
    }, delay);
  }

  private async reconnect(): Promise<void> {
    if (!this.wantListening) return;
    try {
      await this.provider.stop();
      await this.openStream();
      logger.info("STT reconnected");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.scheduleReconnect(message);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  pushAudio(chunk: Buffer): void {
    try {
      this.provider.pushAudio(chunk);
    } catch (err) {
      logger.warn("pushAudio failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async stop(): Promise<void> {
    this.wantListening = false;
    this.clearReconnectTimer();
    try {
      await this.provider.stop();
    } catch (err) {
      logger.warn("STT stop failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    this.setStatus(this.provider.getCapabilities().credentialsConfigured ? "idle" : "unavailable");
  }

  /** Test helper — inject provider. */
  setProviderForTests(provider: SpeechToTextProvider): void {
    this.provider = provider;
    this.lastStatus = provider.getStatus();
  }
}

let liveSession: LiveSessionController | null = null;

export function getLiveSession(): LiveSessionController {
  if (!liveSession) liveSession = new LiveSessionController();
  return liveSession;
}

export function resetLiveSessionForTests(): void {
  liveSession = null;
}
