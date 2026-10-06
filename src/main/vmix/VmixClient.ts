import http from "node:http";
import net from "node:net";
import { URL } from "node:url";
import { logger } from "../security/logger";

export interface VmixClientConfig {
  host: string;
  httpPort: number;
  tcpPort: number;
  /** Request timeout ms */
  timeoutMs?: number;
}

export interface VmixTitleFields {
  input: string;
  reference: string;
  verse: string;
  translation: string;
}

/**
 * Low-level vMix API client.
 * HTTP API (default 8088) for SetText / Overlay; TCP (default 8099) for architecture / health.
 */
export class VmixClient {
  constructor(private config: VmixClientConfig) {}

  updateConfig(config: Partial<VmixClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): VmixClientConfig {
    return { ...this.config };
  }

  /** GET /api/ — returns XML status body when vMix is reachable. */
  async fetchXml(): Promise<string> {
    const url = this.httpUrl("/api/");
    return this.httpGet(url);
  }

  /**
   * SetText via HTTP. Values are URL-encoded.
   * SelectedName should include the `.Text` suffix when the title field requires it
   * (callers may pass either `Reference` or `Reference.Text`).
   */
  async setText(input: string, selectedName: string, value: string): Promise<void> {
    const field = selectedName.endsWith(".Text") ? selectedName : `${selectedName}.Text`;
    const url = this.httpUrl("/api/", {
      Function: "SetText",
      Input: input,
      SelectedName: field,
      Value: value,
    });
    await this.httpGet(url);
  }

  async clearTitleFields(fields: VmixTitleFields): Promise<void> {
    await this.setText(fields.input, fields.reference, "");
    await this.setText(fields.input, fields.verse, "");
    await this.setText(fields.input, fields.translation, "");
  }

  async setTitleFields(
    fields: VmixTitleFields,
    values: { reference: string; verse: string; translation: string },
  ): Promise<void> {
    await this.setText(fields.input, fields.reference, values.reference);
    await this.setText(fields.input, fields.verse, values.verse);
    await this.setText(fields.input, fields.translation, values.translation);
  }

  /** Show overlay channel 1–4 without specifying input. */
  async overlayIn(channel: number): Promise<void> {
    const ch = clampOverlayChannel(channel);
    await this.httpGet(this.httpUrl("/api/", { Function: `OverlayInput${ch}In` }));
  }

  async overlayInInput(channel: number, input: string): Promise<void> {
    const ch = clampOverlayChannel(channel);
    await this.httpGet(
      this.httpUrl("/api/", { Function: `OverlayInput${ch}In`, Input: input }),
    );
  }

  async overlayOut(channel: number): Promise<void> {
    const ch = clampOverlayChannel(channel);
    await this.httpGet(this.httpUrl("/api/", { Function: `OverlayInput${ch}Out` }));
  }

  /** TCP connect + optional XML request — used for health / architecture path. */
  async tcpProbe(): Promise<{ ok: boolean; detail: string }> {
    const { host, tcpPort, timeoutMs = 3000 } = this.config;
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      const finish = (ok: boolean, detail: string) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        resolve({ ok, detail });
      };

      socket.setTimeout(timeoutMs);
      socket.once("connect", () => {
        socket.write("XML\r\n");
      });
      socket.once("data", (buf) => {
        const text = buf.toString("utf8");
        if (text.includes("<vmix") || text.includes("<?xml")) {
          finish(true, `TCP ${host}:${tcpPort} responded with vMix XML`);
        } else {
          finish(true, `TCP ${host}:${tcpPort} connected (${text.slice(0, 40)}…)`);
        }
      });
      socket.once("timeout", () => finish(false, `TCP timeout ${host}:${tcpPort}`));
      socket.once("error", (err) =>
        finish(false, `TCP error: ${err instanceof Error ? err.message : String(err)}`),
      );
      socket.connect(tcpPort, host);
    });
  }

  /** Send a FUNCTION command over TCP (architecture path). */
  async tcpFunction(functionName: string, options?: Record<string, string>): Promise<void> {
    const { host, tcpPort, timeoutMs = 3000 } = this.config;
    const opt =
      options && Object.keys(options).length > 0
        ? " " +
          Object.entries(options)
            .map(([k, v]) => `${k}=${v}`)
            .join("&")
        : "";
    const line = `FUNCTION ${functionName}${opt}\r\n`;

    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        if (err) reject(err);
        else resolve();
      };

      socket.setTimeout(timeoutMs);
      socket.once("connect", () => {
        socket.write(line, (writeErr) => {
          if (writeErr) finish(writeErr);
          else {
            // vMix often does not ACK; brief wait then close
            setTimeout(() => finish(), 50);
          }
        });
      });
      socket.once("timeout", () => finish(new Error(`TCP timeout ${host}:${tcpPort}`)));
      socket.once("error", (err) => finish(err));
      socket.connect(tcpPort, host);
    });
  }

  private httpUrl(pathname: string, query?: Record<string, string>): string {
    const { host, httpPort } = this.config;
    const u = new URL(`http://${host}:${httpPort}${pathname}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        // encodeURIComponent for all values — vMix expects URL-encoded SetText Value
        u.searchParams.set(k, v);
      }
    }
    return u.toString();
  }

  private httpGet(url: string): Promise<string> {
    const timeoutMs = this.config.timeoutMs ?? 3000;
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`vMix HTTP ${res.statusCode}: ${body.slice(0, 120)}`));
            return;
          }
          resolve(body);
        });
      });
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`vMix HTTP timeout: ${url}`));
      });
      req.on("error", (err) => reject(err));
    });
  }
}

function clampOverlayChannel(channel: number): number {
  if (!Number.isFinite(channel)) return 1;
  return Math.min(4, Math.max(1, Math.floor(channel)));
}

/** Build SetText URL for tests / docs (Value URL-encoded). */
export function buildSetTextUrl(
  host: string,
  httpPort: number,
  input: string,
  selectedName: string,
  value: string,
): string {
  const field = selectedName.endsWith(".Text") ? selectedName : `${selectedName}.Text`;
  const u = new URL(`http://${host}:${httpPort}/api/`);
  u.searchParams.set("Function", "SetText");
  u.searchParams.set("Input", input);
  u.searchParams.set("SelectedName", field);
  u.searchParams.set("Value", value);
  return u.toString();
}

export function logVmixSafe(message: string, meta?: Record<string, unknown>): void {
  logger.debug(message, meta);
}
