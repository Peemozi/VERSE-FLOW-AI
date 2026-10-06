import type { AppSettings } from "../../shared/schemas";
import type {
  ConnectionTestResult,
  LiveScripturePayload,
  OutputConnectionStatus,
} from "./BroadcastOutput";
import { VmixOutputAdapter } from "./VmixOutputAdapter";
import { OverlayServer, type OverlayThemeId } from "../overlay/OverlayServer";
import { loadSettings } from "../settings/store";
import { logger } from "../security/logger";
import type { BrowserWindow } from "electron";
import { IpcEvents } from "../../shared/types/ipc";

type StatusCb = (status: OutputConnectionStatus, detail?: string) => void;

function settingsToVmix(s: AppSettings) {
  return {
    host: s.vmix.host,
    httpPort: s.vmix.httpPort,
    tcpPort: s.vmix.tcpPort,
    enabled: s.vmix.enabled,
    inputName: s.vmix.inputName,
    fieldReference: s.vmix.fieldReference,
    fieldVerse: s.vmix.fieldVerse,
    fieldTranslation: s.vmix.fieldTranslation,
    autoOverlay: s.vmix.autoOverlay,
    overlayChannel: s.vmix.overlayChannel,
  };
}

function settingsToOverlay(s: AppSettings) {
  return {
    host: "127.0.0.1",
    port: s.output.overlayPort,
    theme: s.output.overlayTheme as OverlayThemeId,
    enabled: s.output.overlayEnabled,
  };
}

/**
 * Orchestrates vMix adapter + local overlay server.
 * Send Live / Clear Live fan out to both outputs.
 */
export class OutputController {
  private vmix: VmixOutputAdapter;
  private overlay: OverlayServer;
  private window: BrowserWindow | null = null;
  private unsubVmix: (() => void) | null = null;
  private statusListeners = new Set<StatusCb>();

  constructor(settings?: AppSettings) {
    const s = settings ?? loadSettings();
    this.vmix = new VmixOutputAdapter(settingsToVmix(s));
    this.overlay = new OverlayServer(settingsToOverlay(s));
    this.unsubVmix = this.vmix.onStatus((status, detail) => {
      this.emitStatus(status, detail);
      this.pushToRenderer(status, detail);
    });
  }

  setWindow(win: BrowserWindow | null): void {
    this.window = win;
  }

  getVmixStatus(): OutputConnectionStatus {
    return this.vmix.getStatus();
  }

  getOverlayUrl(): string {
    return this.overlay.getOverlayUrl();
  }

  isOverlayListening(): boolean {
    return this.overlay.isListening();
  }

  onStatus(cb: StatusCb): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  async applySettings(settings: AppSettings): Promise<void> {
    const wasOverlay = this.overlay.isListening();
    const nextOverlay = settingsToOverlay(settings);
    const prevOverlay = this.overlay.getConfig();

    this.vmix.updateConfig(settingsToVmix(settings));

    const portChanged = prevOverlay.port !== nextOverlay.port;
    const enabledChanged = prevOverlay.enabled !== nextOverlay.enabled;

    this.overlay.updateConfig(nextOverlay);

    if (wasOverlay && (portChanged || (enabledChanged && !nextOverlay.enabled))) {
      await this.overlay.stop();
    }
    if (nextOverlay.enabled && (!this.overlay.isListening() || portChanged)) {
      try {
        await this.overlay.start();
      } catch (err) {
        logger.warn("Overlay restart failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (settings.vmix.enabled) {
      await this.vmix.connect();
    } else {
      await this.vmix.disconnect();
    }
  }

  async startFromSettings(): Promise<void> {
    const settings = loadSettings();
    await this.applySettings(settings);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return this.vmix.testConnection();
  }

  async connectVmix(): Promise<void> {
    await this.vmix.connect();
  }

  async sendLive(payload: LiveScripturePayload): Promise<{ vmixOk: boolean; overlayOk: boolean; errors: string[] }> {
    const errors: string[] = [];
    let vmixOk = true;
    let overlayOk = true;

    try {
      await this.vmix.sendLive(payload);
    } catch (err) {
      vmixOk = false;
      errors.push(`vMix: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      if (this.overlay.getConfig().enabled) {
        if (!this.overlay.isListening()) {
          await this.overlay.start();
        }
        await this.overlay.sendLive(payload);
      }
    } catch (err) {
      overlayOk = false;
      errors.push(`Overlay: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { vmixOk, overlayOk, errors };
  }

  async clearLive(): Promise<{ vmixOk: boolean; overlayOk: boolean; errors: string[] }> {
    const errors: string[] = [];
    let vmixOk = true;
    let overlayOk = true;

    try {
      await this.vmix.clearLive();
    } catch (err) {
      vmixOk = false;
      errors.push(`vMix: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      await this.overlay.clearLive();
    } catch (err) {
      overlayOk = false;
      errors.push(`Overlay: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { vmixOk, overlayOk, errors };
  }

  async shutdown(): Promise<void> {
    this.unsubVmix?.();
    this.unsubVmix = null;
    await this.vmix.disconnect();
    await this.overlay.stop();
  }

  private emitStatus(status: OutputConnectionStatus, detail?: string): void {
    for (const cb of this.statusListeners) {
      try {
        cb(status, detail);
      } catch {
        /* ignore */
      }
    }
  }

  private pushToRenderer(status: OutputConnectionStatus, detail?: string): void {
    const uiStatus =
      status === "reconnecting" ? "error" : status === "connected" ? "connected" : status === "error" ? "error" : "disconnected";
    try {
      this.window?.webContents.send(IpcEvents.VMIX_STATUS, { status: uiStatus, detail });
    } catch {
      /* ignore */
    }
  }
}

let singleton: OutputController | null = null;

export function getOutputController(): OutputController {
  if (!singleton) singleton = new OutputController();
  return singleton;
}

export async function shutdownOutputController(): Promise<void> {
  if (singleton) {
    await singleton.shutdown();
    singleton = null;
  }
}
