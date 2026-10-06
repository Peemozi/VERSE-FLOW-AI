/**
 * Architect-only stub for a future on-device / Whisper-based provider.
 * Do not implement streaming here in Phase 4 — interface placeholder only.
 */
import type {
  SpeechToTextProvider,
  SttCapabilities,
  SttStatus,
} from "./SpeechToTextProvider";

export class WhisperSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = "whisper";
  private status: SttStatus = "unavailable";

  getCapabilities(): SttCapabilities {
    return {
      providerId: this.id,
      displayName: "Whisper (planned)",
      streaming: false,
      interimResults: false,
      credentialsConfigured: false,
      languageModes: {
        english: { supported: false, languageCodes: [], notes: "Not implemented" },
        yoruba: { supported: false, languageCodes: [], notes: "Not implemented" },
        bilingual: {
          supported: false,
          languageCodes: [],
          bilingualStrategy: "unsupported",
          notes: "Not implemented",
        },
      },
      futureProviders: ["whisper"],
    };
  }

  getStatus(): SttStatus {
    return this.status;
  }

  async start(_options: {
    languageMode: import("../../shared/schemas").LanguageMode;
    sampleRateHertz: number;
    onTranscript: (event: import("./SpeechToTextProvider").TranscriptEvent) => void;
    onStatus: (status: SttStatus, detail?: string) => void;
    onError: (message: string, retryable: boolean) => void;
  }): Promise<void> {
    throw new Error("WhisperSpeechToTextProvider is not implemented (Phase 4 architect stub only)");
  }

  pushAudio(_chunk: Buffer): void {}

  async stop(): Promise<void> {
    this.status = "unavailable";
  }
}
