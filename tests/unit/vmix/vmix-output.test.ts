import { afterEach, describe, expect, it } from "vitest";
import { MockVmixServer } from "../../../src/main/vmix/MockVmixServer";
import { VmixClient, buildSetTextUrl } from "../../../src/main/vmix/VmixClient";
import { VmixOutputAdapter } from "../../../src/main/vmix/VmixOutputAdapter";
import { OverlayServer } from "../../../src/main/overlay/OverlayServer";

describe("buildSetTextUrl", () => {
  it("URL-encodes Value and appends .Text to field names", () => {
    const url = buildSetTextUrl(
      "127.0.0.1",
      8088,
      "Scripture",
      "Reference",
      "John 3:16 — For God so loved",
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("Function")).toBe("SetText");
    expect(parsed.searchParams.get("Input")).toBe("Scripture");
    expect(parsed.searchParams.get("SelectedName")).toBe("Reference.Text");
    expect(parsed.searchParams.get("Value")).toBe("John 3:16 — For God so loved");
    expect(url).toMatch(/Value=John/);
  });

  it("does not double-append .Text", () => {
    const url = buildSetTextUrl("127.0.0.1", 8088, "1", "Verse.Text", "hello");
    expect(new URL(url).searchParams.get("SelectedName")).toBe("Verse.Text");
  });
});

describe("VmixClient + MockVmixServer", () => {
  const mock = new MockVmixServer();
  let ports: { httpPort: number; tcpPort: number };

  afterEach(async () => {
    await mock.stop();
    mock.reset();
  });

  it("tests HTTP + TCP connection", async () => {
    ports = await mock.start();
    const client = new VmixClient({
      host: "127.0.0.1",
      httpPort: ports.httpPort,
      tcpPort: ports.tcpPort,
    });
    const xml = await client.fetchXml();
    expect(xml).toContain("<vmix");
    const tcp = await client.tcpProbe();
    expect(tcp.ok).toBe(true);
  });

  it("SetText encodes and records fields", async () => {
    ports = await mock.start();
    const client = new VmixClient({
      host: "127.0.0.1",
      httpPort: ports.httpPort,
      tcpPort: ports.tcpPort,
    });
    await client.setTitleFields(
      {
        input: "Scripture",
        reference: "Reference",
        verse: "Verse",
        translation: "Translation",
      },
      {
        reference: "JHN 3:16",
        verse: "For God so loved the world",
        translation: "WEB",
      },
    );
    expect(mock.setTextCalls).toHaveLength(3);
    expect(mock.setTextCalls[0]?.selectedName).toBe("Reference.Text");
    expect(mock.setTextCalls[0]?.value).toBe("JHN 3:16");
    expect(mock.setTextCalls[1]?.value).toBe("For God so loved the world");
    expect(mock.setTextCalls[2]?.value).toBe("WEB");
  });

  it("auto overlay In/Out via adapter", async () => {
    ports = await mock.start();
    const adapter = new VmixOutputAdapter({
      host: "127.0.0.1",
      httpPort: ports.httpPort,
      tcpPort: ports.tcpPort,
      enabled: true,
      inputName: "Scripture",
      fieldReference: "Reference",
      fieldVerse: "Verse",
      fieldTranslation: "Translation",
      autoOverlay: true,
      overlayChannel: 2,
    });

    const test = await adapter.testConnection();
    expect(test.ok).toBe(true);
    expect(test.httpOk).toBe(true);

    await adapter.sendLive({
      referenceLabel: "Psalm 23:1",
      verseText: "The Lord is my shepherd",
      translationId: "WEB",
    });
    expect(mock.overlayCalls.some((c) => c === "OverlayInput2In")).toBe(true);

    await adapter.clearLive();
    expect(mock.overlayCalls.some((c) => c === "OverlayInput2Out")).toBe(true);

    await adapter.disconnect();
  });

  it("skips network when disabled", async () => {
    ports = await mock.start();
    const adapter = new VmixOutputAdapter({
      host: "127.0.0.1",
      httpPort: ports.httpPort,
      tcpPort: ports.tcpPort,
      enabled: false,
      inputName: "Scripture",
      fieldReference: "Reference",
      fieldVerse: "Verse",
      fieldTranslation: "Translation",
      autoOverlay: false,
      overlayChannel: 1,
    });
    await adapter.sendLive({
      referenceLabel: "X",
      verseText: "Y",
      translationId: "WEB",
    });
    expect(mock.setTextCalls).toHaveLength(0);
  });
});

describe("OverlayServer", () => {
  const servers: OverlayServer[] = [];

  afterEach(async () => {
    for (const s of servers) {
      await s.stop();
    }
    servers.length = 0;
  });

  it("serves overlay HTML and pushes live state", async () => {
    const server = new OverlayServer({
      host: "127.0.0.1",
      port: 0,
      theme: "clean-lower-third",
      enabled: true,
    });
    servers.push(server);
    await server.start();
    const url = server.getOverlayUrl();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/overlay$/);

    const htmlRes = await fetch(url);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain("VerseFlow Overlay");

    const cssRes = await fetch(url.replace(/\/overlay$/, "/overlay/overlay.css"));
    expect(cssRes.status).toBe(200);
    const css = await cssRes.text();
    expect(css).toContain("transparent");

    await server.sendLive({
      referenceLabel: "John 1:1",
      verseText: "In the beginning was the Word",
      translationId: "WEB",
    });
    const stateRes = await fetch(`http://127.0.0.1:${server.getConfig().port}/api/state`);
    const state = (await stateRes.json()) as {
      visible: boolean;
      theme: string;
      payload: { referenceLabel: string };
    };
    expect(state.visible).toBe(true);
    expect(state.theme).toBe("clean-lower-third");
    expect(state.payload.referenceLabel).toBe("John 1:1");

    await server.clearLive();
    const cleared = (await (
      await fetch(`http://127.0.0.1:${server.getConfig().port}/api/state`)
    ).json()) as { visible: boolean };
    expect(cleared.visible).toBe(false);
  });

  it("supports theme switch including bilingual", async () => {
    const server = new OverlayServer({
      host: "127.0.0.1",
      port: 0,
      theme: "bilingual",
      enabled: true,
    });
    servers.push(server);
    await server.start();
    await server.sendLive({
      referenceLabel: "John 3:16",
      verseText: "For God so loved the world",
      translationId: "WEB",
      secondaryReferenceLabel: "Jòhánù 3:16",
      secondaryVerseText: "Nítorí Ọlọ́run fẹ́ ayé tó bẹ́ẹ̀",
      secondaryTranslationId: "OYCB",
    });
    const state = (await (
      await fetch(`http://127.0.0.1:${server.getConfig().port}/api/state`)
    ).json()) as { theme: string; payload: { secondaryTranslationId: string } };
    expect(state.theme).toBe("bilingual");
    expect(state.payload.secondaryTranslationId).toBe("OYCB");
  });
});
