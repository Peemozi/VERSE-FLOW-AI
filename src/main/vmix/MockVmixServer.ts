import http from "node:http";
import net from "node:net";
import { URL } from "node:url";

export interface MockVmixServerOptions {
  httpPort?: number;
  tcpPort?: number;
  host?: string;
}

export interface MockSetTextCall {
  input: string;
  selectedName: string;
  value: string;
}

/**
 * Lightweight mock of vMix HTTP (8088) + TCP (8099) for automated tests.
 */
export class MockVmixServer {
  private httpServer: http.Server | null = null;
  private tcpServer: net.Server | null = null;
  private httpPort = 0;
  private tcpPort = 0;
  readonly setTextCalls: MockSetTextCall[] = [];
  readonly overlayCalls: string[] = [];
  readonly functionCalls: string[] = [];

  async start(opts: MockVmixServerOptions = {}): Promise<{ httpPort: number; tcpPort: number }> {
    const host = opts.host ?? "127.0.0.1";

    this.httpServer = http.createServer((req, res) => {
      const u = new URL(req.url ?? "/", `http://${host}`);
      if (u.pathname === "/api/" || u.pathname === "/api") {
        const fn = u.searchParams.get("Function");
        if (!fn) {
          res.writeHead(200, { "Content-Type": "text/xml" });
          res.end(
            `<?xml version="1.0"?><vmix><version>1.0</version><inputs></inputs></vmix>`,
          );
          return;
        }
        this.functionCalls.push(fn);
        if (fn === "SetText") {
          this.setTextCalls.push({
            input: u.searchParams.get("Input") ?? "",
            selectedName: u.searchParams.get("SelectedName") ?? "",
            value: u.searchParams.get("Value") ?? "",
          });
        }
        if (fn.startsWith("OverlayInput")) {
          this.overlayCalls.push(fn);
        }
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
        return;
      }
      res.writeHead(404);
      res.end("not found");
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once("error", reject);
      this.httpServer!.listen(opts.httpPort ?? 0, host, () => resolve());
    });
    const httpAddr = this.httpServer.address();
    this.httpPort =
      typeof httpAddr === "object" && httpAddr ? httpAddr.port : (opts.httpPort ?? 0);

    this.tcpServer = net.createServer((socket) => {
      socket.on("data", (buf) => {
        const text = buf.toString("utf8");
        if (text.startsWith("XML")) {
          socket.write(
            `<?xml version="1.0"?><vmix><version>1.0</version><inputs></inputs></vmix>\r\n`,
          );
        } else if (text.startsWith("FUNCTION")) {
          this.functionCalls.push(text.trim());
          socket.write("OK\r\n");
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.tcpServer!.once("error", reject);
      this.tcpServer!.listen(opts.tcpPort ?? 0, host, () => resolve());
    });
    const tcpAddr = this.tcpServer.address();
    this.tcpPort =
      typeof tcpAddr === "object" && tcpAddr ? tcpAddr.port : (opts.tcpPort ?? 0);

    return { httpPort: this.httpPort, tcpPort: this.tcpPort };
  }

  getHttpPort(): number {
    return this.httpPort;
  }

  getTcpPort(): number {
    return this.tcpPort;
  }

  reset(): void {
    this.setTextCalls.length = 0;
    this.overlayCalls.length = 0;
    this.functionCalls.length = 0;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.httpServer) {
        resolve();
        return;
      }
      this.httpServer.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      if (!this.tcpServer) {
        resolve();
        return;
      }
      this.tcpServer.close(() => resolve());
    });
    this.httpServer = null;
    this.tcpServer = null;
  }
}
