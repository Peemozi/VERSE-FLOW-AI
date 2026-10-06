import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  LiveSessionController,
  resetLiveSessionForTests,
} from "../../../src/main/transcription/LiveSessionController";
import type {
  SpeechToTextProvider,
  SttCapabilities,
  SttStatus,
  TranscriptEvent,
} from "../../../src/main/transcription/SpeechToTextProvider";
import { UnavailableSpeechProvider, googleLanguageConfig } from "../../../src/main/transcription/UnavailableSpeechProvider";
import { ReconnectBackoff } from "../../../src/main/transcription/reconnectBackoff";
import { GoogleCloudSpeechProvider } from "../../../src/main/transcription/GoogleCloudSpeechProvider";
import { openTestDatabase, closeDatabase } from "../../../src/main/database/connection";
import { BibleRepository, normalizedForSearch } from "../../../src/main/database/BibleRepository";
import { resetScriptureDetector } from "../../../src/main/scripture/detectorService";

class FakeSpeechProvider implements SpeechToTextProvider {
  readonly id = "fake";
  status: SttStatus = "idle";
  onTranscript: ((e: TranscriptEvent) => void) | null = null;
  onStatus: ((s: SttStatus, d?: string) => void) | null = null;
  onError: ((m: string, r: boolean) => void) | null = null;
  chunks: Buffer[] = [];
  started = false;

  getCapabilities(): SttCapabilities {
    return {
      providerId: this.id,
      displayName: "Fake STT",
      streaming: true,
      interimResults: true,
      credentialsConfigured: true,
      languageModes: {
        english: { supported: true, languageCodes: ["en-NG"] },
        yoruba: { supported: true, languageCodes: ["yo-NG"] },
        bilingual: {
          supported: true,
          languageCodes: ["en-NG", "yo-NG"],
          bilingualStrategy: "alternative-language-codes",
          notes: "test",
        },
      },
      futureProviders: [],
    };
  }

  getStatus(): SttStatus {
    return this.status;
  }

  async start(options: {
    languageMode: "english" | "yoruba" | "bilingual";
    sampleRateHertz: number;
    onTranscript: (event: TranscriptEvent) => void;
    onStatus: (status: SttStatus, detail?: string) => void;
    onError: (message: string, retryable: boolean) => void;
  }): Promise<void> {
    this.onTranscript = options.onTranscript;
    this.onStatus = options.onStatus;
    this.onError = options.onError;
    this.started = true;
    this.status = "listening";
    options.onStatus("listening");
  }

  pushAudio(chunk: Buffer): void {
    this.chunks.push(chunk);
  }

  async stop(): Promise<void> {
    this.status = "idle";
    this.started = false;
    this.onStatus?.("idle");
  }

  emit(text: string, isFinal: boolean): void {
    this.onTranscript?.({
      text,
      isFinal,
      receivedAt: new Date().toISOString(),
    });
  }

  fail(message: string, retryable: boolean): void {
    this.status = "error";
    this.onError?.(message, retryable);
  }
}

describe("googleLanguageConfig", () => {
  it("maps modes honestly", () => {
    expect(googleLanguageConfig("english").alternativeLanguageCodes).toEqual([]);
    expect(googleLanguageConfig("yoruba").languageCode).toContain("yo");
    const bi = googleLanguageConfig("bilingual");
    expect(bi.alternativeLanguageCodes.length).toBeGreaterThan(0);
  });
});

describe("UnavailableSpeechProvider", () => {
  it("reports no credentials and refuses to start", async () => {
    const p = new UnavailableSpeechProvider("missing creds");
    expect(p.getCapabilities().credentialsConfigured).toBe(false);
    expect(p.getCapabilities().languageModes.bilingual.supported).toBe(false);
    await expect(p.start({} as never)).rejects.toThrow(/missing creds/);
  });
});

describe("GoogleCloudSpeechProvider capabilities", () => {
  it("exposes alternative-language-codes bilingual strategy", () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const p = new GoogleCloudSpeechProvider();
    const caps = p.getCapabilities();
    expect(caps.languageModes.bilingual.bilingualStrategy).toBe("alternative-language-codes");
    expect(caps.credentialsConfigured).toBe(false);
    if (prev !== undefined) process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
  });
});

describe("ReconnectBackoff", () => {
  it("increases attempt and stays within max", () => {
    const b = new ReconnectBackoff(100, 500);
    const d1 = b.nextDelayMs();
    const d2 = b.nextDelayMs();
    expect(d1).toBeGreaterThanOrEqual(0);
    expect(d1).toBeLessThanOrEqual(100);
    expect(d2).toBeLessThanOrEqual(200);
    expect(b.getAttempt()).toBe(2);
    b.reset();
    expect(b.getAttempt()).toBe(0);
  });
});

describe("LiveSessionController", () => {
  let fake: FakeSpeechProvider;
  let session: LiveSessionController;

  beforeEach(() => {
    resetLiveSessionForTests();
    resetScriptureDetector();
    closeDatabase();
    const db = openTestDatabase(":memory:");
    const repo = new BibleRepository(db);
    repo.seedCanonicalBooks();
    repo.upsertTranslation({
      id: "WEB",
      name: "WEB",
      language: "en",
      license: "Public Domain",
      attribution: "test",
    });
    repo.insertVerses([
      {
        translationId: "WEB",
        bookId: "JHN",
        chapter: 3,
        verse: 16,
        originalText: "For God so loved the world",
        normalizedText: normalizedForSearch("For God so loved the world"),
      },
    ]);

    // Point detector service at test db via openDatabase already set
    fake = new FakeSpeechProvider();
    session = new LiveSessionController(fake);
  });

  afterEach(async () => {
    await session.stop();
    vi.useRealTimers();
    closeDatabase();
  });

  it("feeds final transcripts into ScriptureDetector", async () => {
    const detections: unknown[] = [];
    session.setWindow({
      isDestroyed: () => false,
      webContents: {
        send: (channel: string, payload: unknown) => {
          if (channel === "stt:event:detections") detections.push(payload);
        },
      },
    } as never);

    const started = await session.start({ languageMode: "english" });
    expect(started.ok).toBe(true);

    fake.emit("please open John 3:16", false);
    fake.emit("please open John 3:16", true);

    expect(detections.length).toBe(1);
    const payload = detections[0] as { detections: Array<{ bookId: string; verse: number }> };
    expect(payload.detections[0]).toMatchObject({ bookId: "JHN", verse: 16 });
  });

  it("accepts audio chunks while listening", async () => {
    await session.start({ languageMode: "english" });
    session.pushAudio(Buffer.from([0, 1, 2, 3]));
    expect(fake.chunks).toHaveLength(1);
  });

  it("schedules reconnect on retryable errors without throwing", async () => {
    vi.useFakeTimers();
    await session.start({ languageMode: "english" });
    fake.fail("stream reset", true);
    expect(session.getStatus()).toBe("reconnecting");
    // Allow backoff timer (jittered) to fire
    await vi.advanceTimersByTimeAsync(35_000);
    expect(fake.started).toBe(true);
  });
});
