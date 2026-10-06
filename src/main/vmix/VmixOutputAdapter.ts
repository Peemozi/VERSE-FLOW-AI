import {
  type BroadcastOutput,
  type ConnectionTestResult,
  type LiveScripturePayload,
  type OutputConnectionStatus,
} from "./BroadcastOutput";
import { VmixClient, type VmixTitleFields } from "./VmixClient";
import { ReconnectBackoff } from "../transcription/reconnectBackoff";
import { logger } from "../security/logger";

export interface VmixAdapterConfig {
  host: string;
  httpPort: number;
  tcpPort: number;
  enabled: boolean;
  inputName: string;
  fieldReference: string;
  fieldVerse: string;
  fieldTranslation: string;
  autoOverlay: boolean;
  overlayChannel: number;
}

type StatusListener = (status: OutputConnectionStatus, detail?: string) => void;

/**
 * BroadcastOutput adapter for vMix HTTP (SetText / Overlay) + TCP health.
 * Never throws out of reconnect loops — surfaces status instead.
 */
export class VmixOutputAdapter implements BroadcastOutput {
  readonly id = "vmix";
  private client: VmixClient;
  private config: VmixAdapterConfig;
  private status: OutputConnectionStatus = "disconnected";
  private listeners = new Set<StatusListener>();
  private backoff = new ReconnectBackoff(1000, 30_000);
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wantConnected = false;

  constructor(config: VmixAdapterConfig) {
    this.config = config;
    this.client = new VmixClient({
      host: config.host,
      httpPort: config.httpPort,
      tcpPort: config.tcpPort,
    });
  }

  updateConfig(config: Partial<VmixAdapterConfig>): void {
    this.config = { ...this.config, ...config };
    this.client.updateConfig({
      host: this.config.host,
      httpPort: this.config.httpPort,
      tcpPort: this.config.tcpPort,
    });
  }

  getConfig(): VmixAdapterConfig {
    return { ...this.config };
  }

  getStatus(): OutputConnectionStatus {
    return this.status;
  }

  onStatus(cb: StatusListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async connect(): Promise<void> {
    this.wantConnected = true;
    this.clearReconnectTimer();
    if (!this.config.enabled) {
      this.setStatus("disconnected", "vMix disabled in settings");
      return;
    }
    try {
      const result = await this.testConnection();
      if (result.ok) {
        this.backoff.reset();
        this.setStatus("connected", result.detail);
      } else {
        this.setStatus("error", result.detail);
        this.scheduleReconnect();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus("error", msg);
      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    this.wantConnected = false;
    this.clearReconnectTimer();
    this.backoff.reset();
    this.setStatus("disconnected", "Disconnected");
  }

  async testConnection(): Promise<ConnectionTestResult> {
    let httpOk = false;
    let tcpOk = false;
    let httpDetail = "";
    let tcpDetail = "";

    try {
      const xml = await this.client.fetchXml();
      httpOk = xml.includes("<vmix") || xml.includes("<?xml") || xml.length > 0;
      httpDetail = httpOk
        ? `HTTP ${this.config.host}:${this.config.httpPort} OK`
        : `HTTP empty response`;
    } catch (err) {
      httpDetail = err instanceof Error ? err.message : String(err);
    }

    const tcp = await this.client.tcpProbe();
    tcpOk = tcp.ok;
    tcpDetail = tcp.detail;

    const ok = httpOk || tcpOk;
    const detail = [httpDetail, tcpDetail].filter(Boolean).join("; ");
    return { ok, detail, httpOk, tcpOk };
  }

  async sendLive(payload: LiveScripturePayload): Promise<void> {
    if (!this.config.enabled) {
      logger.debug("vMix sendLive skipped — disabled");
      return;
    }
    const fields = this.titleFields();
    try {
      await this.client.setTitleFields(fields, {
        reference: payload.referenceLabel,
        verse: payload.verseText,
        translation: payload.translationId,
      });
      if (this.config.autoOverlay) {
        await this.client.overlayInInput(this.config.overlayChannel, fields.input);
      }
      if (this.status !== "connected") {
        this.backoff.reset();
        this.setStatus("connected", "Send Live succeeded");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("vMix sendLive failed", { error: msg });
      this.setStatus("error", msg);
      this.scheduleReconnect();
      throw err;
    }
  }

  async clearLive(): Promise<void> {
    if (!this.config.enabled) {
      logger.debug("vMix clearLive skipped — disabled");
      return;
    }
    const fields = this.titleFields();
    try {
      await this.client.clearTitleFields(fields);
      if (this.config.autoOverlay) {
        await this.client.overlayOut(this.config.overlayChannel);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("vMix clearLive failed", { error: msg });
      this.setStatus("error", msg);
      this.scheduleReconnect();
      throw err;
    }
  }

  private titleFields(): VmixTitleFields {
    return {
      input: this.config.inputName,
      reference: this.config.fieldReference,
      verse: this.config.fieldVerse,
      translation: this.config.fieldTranslation,
    };
  }

  private setStatus(status: OutputConnectionStatus, detail?: string): void {
    this.status = status;
    for (const cb of this.listeners) {
      try {
        cb(status, detail);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.wantConnected || !this.config.enabled) return;
    this.clearReconnectTimer();
    const delay = this.backoff.nextDelayMs();
    this.setStatus("reconnecting", `Retry in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
