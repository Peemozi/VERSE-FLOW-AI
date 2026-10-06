/** Swappable broadcast output (vMix, overlay, future OBS/NDI). */

export type OutputConnectionStatus =
  | "disconnected"
  | "connected"
  | "error"
  | "reconnecting";

export interface LiveScripturePayload {
  referenceLabel: string;
  verseText: string;
  translationId: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  endVerse?: number;
  /** Optional second language for bilingual overlay theme */
  secondaryReferenceLabel?: string;
  secondaryVerseText?: string;
  secondaryTranslationId?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  detail: string;
  httpOk?: boolean;
  tcpOk?: boolean;
}

export interface BroadcastOutput {
  readonly id: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): OutputConnectionStatus;
  testConnection(): Promise<ConnectionTestResult>;
  sendLive(payload: LiveScripturePayload): Promise<void>;
  clearLive(): Promise<void>;
  onStatus(cb: (status: OutputConnectionStatus, detail?: string) => void): () => void;
}
