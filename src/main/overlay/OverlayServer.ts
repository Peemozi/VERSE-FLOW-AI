import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type { LiveScripturePayload } from "../vmix/BroadcastOutput";
import { logger } from "../security/logger";
import { getResourcesRoot } from "../paths";

export type OverlayThemeId =
  | "clean-lower-third"
  | "full-scripture"
  | "minimal"
  | "bilingual";

export interface OverlayState {
  visible: boolean;
  theme: OverlayThemeId;
  payload: LiveScripturePayload | null;
  updatedAt: string;
}

export interface OverlayServerConfig {
  host: string;
  port: number;
  theme: OverlayThemeId;
  enabled: boolean;
}

/** How many alternate ports to try after the preferred port is busy. */
export const OVERLAY_PORT_FALLBACK_COUNT = 9;

export type OverlayListenStatus = "stopped" | "listening" | "error" | "disabled";

export interface OverlayStatusSnapshot {
  status: OverlayListenStatus;
  url: string;
  host: string;
  port: number;
  preferredPort: number;
  remapped: boolean;
  listening: boolean;
  enabled: boolean;
  theme: OverlayThemeId;
  error: string | null;
}

function resolveOverlayDir(): string {
  const candidates = [
    path.join(getResourcesRoot(), "overlay"),
    path.join(process.cwd(), "resources", "overlay"),
    path.join(__dirname, "../../../resources/overlay"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "index.html"))) return c;
  }
  return candidates[0]!;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

/**
 * Local HTTP + WebSocket overlay for vMix Browser input (transparent background).
 * Point vMix Browser source at http://127.0.0.1:<port>/overlay
 */
export class OverlayServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private config: OverlayServerConfig;
  private state: OverlayState;
  private clients = new Set<WebSocket>();
  private preferredPort: number;
  private lastError: string | null = null;
  private remapped = false;

  constructor(config: OverlayServerConfig) {
    this.config = config;
    this.preferredPort = config.port;
    this.state = {
      visible: false,
      theme: config.theme,
      payload: null,
      updatedAt: new Date().toISOString(),
    };
  }

  updateConfig(partial: Partial<OverlayServerConfig>): void {
    this.config = { ...this.config, ...partial };
    if (partial.port !== undefined) {
      this.preferredPort = partial.port;
      this.remapped = false;
    }
    if (partial.theme) {
      this.state = { ...this.state, theme: partial.theme, updatedAt: new Date().toISOString() };
      this.broadcast();
    }
  }

  getConfig(): OverlayServerConfig {
    return { ...this.config };
  }

  getState(): OverlayState {
    return { ...this.state, payload: this.state.payload ? { ...this.state.payload } : null };
  }

  getOverlayUrl(): string {
    return `http://${this.config.host}:${this.config.port}/overlay`;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getStatusSnapshot(): OverlayStatusSnapshot {
    const listening = this.isListening();
    let status: OverlayListenStatus = "stopped";
    if (!this.config.enabled) status = "disabled";
    else if (listening) status = "listening";
    else if (this.lastError) status = "error";
    return {
      status,
      url: this.getOverlayUrl(),
      host: this.config.host,
      port: this.config.port,
      preferredPort: this.preferredPort,
      remapped: this.remapped,
      listening,
      enabled: this.config.enabled,
      theme: this.config.theme,
      error: this.lastError,
    };
  }

  isListening(): boolean {
    return this.server !== null && this.server.listening;
  }

  /**
   * Bind HTTP + WS. On EADDRINUSE, tries preferredPort+1 … +OVERLAY_PORT_FALLBACK_COUNT.
   * Never throws for bind failures — sets lastError and leaves listening=false so Electron stays up.
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.lastError = null;
      this.remapped = false;
      logger.info("Overlay server not started — disabled");
      return;
    }
    if (this.isListening()) return;

    const overlayDir = resolveOverlayDir();
    if (!fs.existsSync(path.join(overlayDir, "index.html"))) {
      this.lastError = `Overlay assets missing at ${overlayDir} (expected index.html)`;
      logger.warn("Overlay start aborted — missing assets", { overlayDir });
      return;
    }

    const preferred = this.preferredPort;
    const candidates = [
      preferred,
      ...Array.from({ length: OVERLAY_PORT_FALLBACK_COUNT }, (_, i) => preferred + i + 1),
    ];

    let lastBindError: string | null = null;
    for (const port of candidates) {
      try {
        await this.listenOn(port, overlayDir);
        this.lastError = null;
        this.remapped = port !== preferred;
        if (this.remapped) {
          logger.warn("Overlay preferred port busy; remapped", {
            from: preferred,
            to: port,
            url: this.getOverlayUrl(),
          });
        } else {
          logger.info("Overlay server listening", {
            url: this.getOverlayUrl(),
            theme: this.config.theme,
          });
        }
        return;
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
        const message = err instanceof Error ? err.message : String(err);
        lastBindError = code === "EADDRINUSE"
          ? `Port ${port} is already in use`
          : message;
        await this.teardownServer();
        if (code !== "EADDRINUSE") {
          this.lastError = `Overlay failed to start: ${message}. Free the port or change Settings → OUTPUT → Port, then Restart Overlay Server.`;
          logger.warn("Overlay start failed", { port, error: message, code });
          return;
        }
      }
    }

    const rangeEnd = candidates[candidates.length - 1]!;
    this.lastError =
      `Ports ${preferred}–${rangeEnd} are busy on ${this.config.host}. ` +
      `Close the other app (or change Settings → OUTPUT → Port) and click Restart Overlay Server.`;
    logger.warn("Overlay start failed — all candidate ports busy", {
      preferred,
      rangeEnd,
    });
    void lastBindError;
  }

  private async listenOn(port: number, overlayDir: string): Promise<void> {
    this.server = http.createServer((req, res) => {
      try {
        this.handleHttp(req, res, overlayDir);
      } catch (err) {
        logger.warn("Overlay HTTP error", {
          error: err instanceof Error ? err.message : String(err),
        });
        res.writeHead(500);
        res.end("error");
      }
    });

    this.wss = new WebSocketServer({ noServer: true });
    this.server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", `http://${this.config.host}`);
      if (url.pathname !== "/ws" && url.pathname !== "/overlay/ws") {
        socket.destroy();
        return;
      }
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.clients.add(ws);
        ws.send(JSON.stringify({ type: "state", state: this.state }));
        ws.on("close", () => this.clients.delete(ws));
        ws.on("error", () => this.clients.delete(ws));
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(port, this.config.host, () => resolve());
    });

    const addr = this.server.address();
    if (typeof addr === "object" && addr) {
      this.config = { ...this.config, port: addr.port };
    } else {
      this.config = { ...this.config, port };
    }
  }

  private async teardownServer(): Promise<void> {
    for (const ws of this.clients) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();

    await new Promise<void>((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }
      this.wss.close(() => resolve());
    });
    this.wss = null;

    await new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => resolve());
    });
    this.server = null;
  }

  async stop(): Promise<void> {
    await this.teardownServer();
    this.remapped = false;
    if (this.config.enabled) {
      this.lastError = null;
    }
  }

  async sendLive(payload: LiveScripturePayload): Promise<void> {
    this.state = {
      visible: true,
      theme: this.config.theme,
      payload,
      updatedAt: new Date().toISOString(),
    };
    this.broadcast();
  }

  async clearLive(): Promise<void> {
    this.state = {
      ...this.state,
      visible: false,
      payload: null,
      updatedAt: new Date().toISOString(),
    };
    this.broadcast();
  }

  private broadcast(): void {
    const msg = JSON.stringify({ type: "state", state: this.state });
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(msg);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private handleHttp(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    overlayDir: string,
  ): void {
    const url = new URL(req.url ?? "/", `http://${this.config.host}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          theme: this.config.theme,
          port: this.config.port,
          host: this.config.host,
        }),
      );
      return;
    }

    if (url.pathname === "/api/state") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(this.state));
      return;
    }

    // /overlay and /overlay/ → index.html
    let rel = url.pathname;
    if (rel === "/overlay" || rel === "/overlay/") {
      rel = "/index.html";
    } else if (rel.startsWith("/overlay/")) {
      rel = rel.slice("/overlay".length);
    }

    // Prevent path traversal
    const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(overlayDir, safe === path.sep || safe === "" ? "index.html" : safe);

    if (!filePath.startsWith(overlayDir)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    const ext = path.extname(filePath);
    const mime = MIME[ext] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
      // Transparent browser source friendly
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(filePath).pipe(res);
  }
}
