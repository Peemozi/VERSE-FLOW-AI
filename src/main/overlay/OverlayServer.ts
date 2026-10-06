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

  constructor(config: OverlayServerConfig) {
    this.config = config;
    this.state = {
      visible: false,
      theme: config.theme,
      payload: null,
      updatedAt: new Date().toISOString(),
    };
  }

  updateConfig(partial: Partial<OverlayServerConfig>): void {
    this.config = { ...this.config, ...partial };
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

  isListening(): boolean {
    return this.server !== null && this.server.listening;
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("Overlay server not started — disabled");
      return;
    }
    if (this.isListening()) return;

    const overlayDir = resolveOverlayDir();

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
      this.server!.listen(this.config.port, this.config.host, () => resolve());
    });

    const addr = this.server.address();
    if (typeof addr === "object" && addr) {
      this.config = { ...this.config, port: addr.port };
    }

    logger.info("Overlay server listening", {
      url: this.getOverlayUrl(),
      theme: this.config.theme,
    });
  }

  async stop(): Promise<void> {
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
      res.end(JSON.stringify({ ok: true, theme: this.config.theme }));
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
