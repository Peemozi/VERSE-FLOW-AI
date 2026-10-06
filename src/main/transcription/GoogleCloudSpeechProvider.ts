import { SpeechClient, protos } from "@google-cloud/speech";
import type { LanguageMode } from "../../shared/schemas";
import { logger } from "../security/logger";
import {
  type SpeechToTextProvider,
  type SttCapabilities,
  type SttStatus,
  type TranscriptEvent,
} from "./SpeechToTextProvider";
import { googleLanguageConfig } from "./UnavailableSpeechProvider";

type StreamingRecognizeStream = ReturnType<SpeechClient["streamingRecognize"]>;

/**
 * Google Cloud Speech-to-Text streaming provider (main process only).
 * Credentials via GOOGLE_APPLICATION_CREDENTIALS — never log secret contents.
 */
export class GoogleCloudSpeechProvider implements SpeechToTextProvider {
  readonly id = "google-cloud";
  private client: SpeechClient | null = null;
  private stream: StreamingRecognizeStream | null = null;
  private status: SttStatus = "idle";
  private onTranscript: ((e: TranscriptEvent) => void) | null = null;
  private onStatus: ((s: SttStatus, detail?: string) => void) | null = null;
  private onError: ((message: string, retryable: boolean) => void) | null = null;
  private languageMode: LanguageMode = "english";
  private sampleRateHertz = 16000;

  static credentialsConfigured(): boolean {
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return Boolean(path && path.trim().length > 0);
  }

  getCapabilities(): SttCapabilities {
    const configured = GoogleCloudSpeechProvider.credentialsConfigured();
    return {
      providerId: this.id,
      displayName: "Google Cloud Speech-to-Text",
      streaming: true,
      interimResults: true,
      credentialsConfigured: configured,
      languageModes: {
        english: {
          supported: true,
          languageCodes: [process.env.VERSEFLOW_STT_EN_CODE ?? "en-NG", "en-US"],
        },
        yoruba: {
          supported: true,
          languageCodes: [process.env.VERSEFLOW_STT_YO_CODE ?? "yo-NG"],
        },
        bilingual: {
          supported: true,
          languageCodes: [
            process.env.VERSEFLOW_STT_EN_CODE ?? "en-NG",
            process.env.VERSEFLOW_STT_YO_CODE ?? "yo-NG",
          ],
          bilingualStrategy: "alternative-language-codes",
          notes:
            "Bilingual uses a primary languageCode plus alternativeLanguageCodes. This is not two independent ASR engines or true simultaneous bilingual decoding.",
        },
      },
      futureProviders: ["whisper (architected, not implemented)"],
    };
  }

  getStatus(): SttStatus {
    return this.status;
  }

  private setStatus(status: SttStatus, detail?: string): void {
    this.status = status;
    this.onStatus?.(status, detail);
  }

  private ensureClient(): SpeechClient {
    if (!GoogleCloudSpeechProvider.credentialsConfigured()) {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set");
    }
    if (!this.client) {
      this.client = new SpeechClient();
    }
    return this.client;
  }

  async start(options: {
    languageMode: LanguageMode;
    sampleRateHertz: number;
    onTranscript: (event: TranscriptEvent) => void;
    onStatus: (status: SttStatus, detail?: string) => void;
    onError: (message: string, retryable: boolean) => void;
  }): Promise<void> {
    await this.stop();
    this.onTranscript = options.onTranscript;
    this.onStatus = options.onStatus;
    this.onError = options.onError;
    this.languageMode = options.languageMode;
    this.sampleRateHertz = options.sampleRateHertz;

    try {
      const client = this.ensureClient();
      const lang = googleLanguageConfig(this.languageMode);

      const request: protos.google.cloud.speech.v1.IStreamingRecognitionConfig = {
        config: {
          encoding: "LINEAR16",
          sampleRateHertz: this.sampleRateHertz,
          languageCode: lang.languageCode,
          alternativeLanguageCodes: lang.alternativeLanguageCodes.length
            ? lang.alternativeLanguageCodes
            : undefined,
          enableAutomaticPunctuation: true,
        },
        interimResults: true,
        singleUtterance: false,
      };

      const stream = client.streamingRecognize();
      this.stream = stream;

      stream.on("data", (data: protos.google.cloud.speech.v1.StreamingRecognizeResponse) => {
        try {
          const results = data.results ?? [];
          for (const result of results) {
            const alt = result.alternatives?.[0];
            if (!alt?.transcript) continue;
            const event: TranscriptEvent = {
              text: alt.transcript,
              isFinal: Boolean(result.isFinal),
              stability: result.stability ?? undefined,
              languageCode: result.languageCode ?? lang.languageCode,
              receivedAt: new Date().toISOString(),
            };
            this.onTranscript?.(event);
          }
        } catch (err) {
          logger.warn("STT result parse error", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      stream.on("error", (err: Error) => {
        logger.warn("Google STT stream error", { error: err.message });
        this.stream = null;
        this.setStatus("error", err.message);
        this.onError?.(err.message, true);
      });

      stream.on("end", () => {
        this.stream = null;
        if (this.status === "listening") {
          this.setStatus("idle", "stream ended");
        }
      });

      stream.write({ streamingConfig: request });
      this.setStatus("listening");
      logger.info("Google STT stream started", {
        languageMode: this.languageMode,
        languageCode: lang.languageCode,
        alternatives: lang.alternativeLanguageCodes,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Failed to start Google STT", { error: message });
      this.setStatus("unavailable", message);
      this.onError?.(message, false);
      throw err;
    }
  }

  pushAudio(chunk: Buffer): void {
    if (!this.stream || this.status !== "listening") return;
    try {
      this.stream.write({ audioContent: chunk });
    } catch (err) {
      logger.warn("STT audio write failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async stop(): Promise<void> {
    const stream = this.stream;
    this.stream = null;
    if (stream) {
      try {
        stream.end();
      } catch {
        // ignore
      }
      try {
        stream.removeAllListeners();
      } catch {
        // ignore
      }
    }
    if (this.status === "listening" || this.status === "reconnecting" || this.status === "error") {
      this.setStatus("idle");
    }
  }
}
