import type { LanguageMode } from "../../shared/schemas";
import type {
  SpeechToTextProvider,
  SttCapabilities,
  SttStatus,
  TranscriptEvent,
} from "./SpeechToTextProvider";

/**
 * Used when GOOGLE_APPLICATION_CREDENTIALS is missing or invalid.
 * Reports honest unavailable status — does not invent transcripts.
 */
export class UnavailableSpeechProvider implements SpeechToTextProvider {
  readonly id = "unavailable";
  private status: SttStatus = "unavailable";
  private reason: string;

  constructor(reason = "GOOGLE_APPLICATION_CREDENTIALS is not set") {
    this.reason = reason;
  }

  getCapabilities(): SttCapabilities {
    return {
      providerId: this.id,
      displayName: "Speech recognition unavailable",
      streaming: false,
      interimResults: false,
      credentialsConfigured: false,
      languageModes: {
        english: { supported: false, languageCodes: [], notes: this.reason },
        yoruba: { supported: false, languageCodes: [], notes: this.reason },
        bilingual: {
          supported: false,
          languageCodes: [],
          bilingualStrategy: "unsupported",
          notes: this.reason,
        },
      },
      futureProviders: ["whisper (architected, not implemented)"],
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
    this.status = "unavailable";
    throw new Error(`Cannot start STT: ${this.reason}`);
  }

  pushAudio(_chunk: Buffer): void {
    // discard — privacy: never persist
  }

  async stop(): Promise<void> {
    this.status = "unavailable";
  }
}

/** Language code mapping for Google STT — configurable overrides via env later. */
export function googleLanguageConfig(mode: LanguageMode): {
  languageCode: string;
  alternativeLanguageCodes: string[];
} {
  const en = process.env.VERSEFLOW_STT_EN_CODE ?? "en-NG";
  const yo = process.env.VERSEFLOW_STT_YO_CODE ?? "yo-NG";
  switch (mode) {
    case "english":
      return { languageCode: en, alternativeLanguageCodes: [] };
    case "yoruba":
      return { languageCode: yo, alternativeLanguageCodes: [] };
    case "bilingual":
      // Honest: Google alternativeLanguageCodes — not two independent engines.
      return { languageCode: en, alternativeLanguageCodes: [yo] };
    default:
      return { languageCode: en, alternativeLanguageCodes: [] };
  }
}
