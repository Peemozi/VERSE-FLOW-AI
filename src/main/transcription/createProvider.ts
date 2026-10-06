import { GoogleCloudSpeechProvider } from "./GoogleCloudSpeechProvider";
import type { SpeechToTextProvider } from "./SpeechToTextProvider";
import { UnavailableSpeechProvider } from "./UnavailableSpeechProvider";

/** Resolve the active STT provider for this process. */
export function createSpeechToTextProvider(): SpeechToTextProvider {
  if (GoogleCloudSpeechProvider.credentialsConfigured()) {
    return new GoogleCloudSpeechProvider();
  }
  return new UnavailableSpeechProvider(
    "Set GOOGLE_APPLICATION_CREDENTIALS to a Google Cloud service-account JSON path to enable live speech.",
  );
}
