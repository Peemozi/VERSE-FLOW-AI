# Transcription (Phase 4)

## Overview

Live speech uses a `SpeechToTextProvider` abstraction in the **main process**.
Credentials never enter the renderer.

MVP provider: **Google Cloud Speech-to-Text** streaming (`LINEAR16` mono @ 16 kHz).

Future (architect stub only): `WhisperSpeechToTextProvider`.

## Configure Google STT

1. Create a Google Cloud project and enable the Cloud Speech-to-Text API.
2. Create a service account with Speech Client permissions.
3. Download the JSON key (keep it outside the repo).
4. Set the env var before launching:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
npm run dev
```

Or copy `.env.example` → `.env` (gitignored) and load it in your shell.

Without credentials, the app stays usable: Bible lookup + Simulation Mode work; Listen reports `unavailable` and does not crash.

## Language modes

| Mode | Behaviour |
| --- | --- |
| English | `en-NG` (override `VERSEFLOW_STT_EN_CODE`) |
| Yoruba | `yo-NG` (override `VERSEFLOW_STT_YO_CODE`) |
| Bilingual | Primary `en-NG` + `alternativeLanguageCodes: [yo-NG]` |

**Honesty:** bilingual is *not* two independent ASR engines. Capabilities expose `bilingualStrategy: "alternative-language-codes"`.

## Audio path

1. Renderer lists devices via `navigator.mediaDevices`.
2. On Listen: `getUserMedia` → level meter + downsample to 16 kHz PCM.
3. PCM chunks IPC to main (`stt:pushAudio`) — streamed and discarded (no disk recording by default).
4. Google streaming recognize → interim + final transcript events.
5. **Finals** enter the same Phase 3 `ScriptureDetector` as Simulation Mode.

## Reliability

- Stream errors → status `error` / `reconnecting` with exponential backoff + jitter.
- Mic permission loss → Listen fails with a status message; app stays up.
- Stop Listen always tears down capture + STT stream.
