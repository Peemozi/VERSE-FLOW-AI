import type { LanguageMode } from "../../shared/schemas";

export type SttStatus = "unavailable" | "idle" | "listening" | "error" | "reconnecting";

export interface SttLanguageModeCapability {
  supported: boolean;
  languageCodes: string[];
  /** How bilingual is implemented — never claim true dual-ASR if we only use alternatives. */
  bilingualStrategy?: "unsupported" | "alternative-language-codes";
  notes?: string;
}

export interface SttCapabilities {
  providerId: string;
  displayName: string;
  streaming: boolean;
  interimResults: boolean;
  credentialsConfigured: boolean;
  languageModes: Record<LanguageMode, SttLanguageModeCapability>;
  /** Future providers (e.g. Whisper) are architected but not implemented. */
  futureProviders: string[];
}

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  stability?: number;
  languageCode?: string;
  receivedAt: string;
}

export interface SpeechToTextProvider {
  readonly id: string;
  getCapabilities(): SttCapabilities;
  getStatus(): SttStatus;
  start(options: {
    languageMode: LanguageMode;
    sampleRateHertz: number;
    onTranscript: (event: TranscriptEvent) => void;
    onStatus: (status: SttStatus, detail?: string) => void;
    onError: (message: string, retryable: boolean) => void;
  }): Promise<void>;
  /** LINEAR16 mono PCM chunk */
  pushAudio(chunk: Buffer): void;
  stop(): Promise<void>;
}
