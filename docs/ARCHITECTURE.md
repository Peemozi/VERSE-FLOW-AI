# VerseFlow AI — Architecture

Working name: **VerseFlow AI** (centralized in `src/shared/constants/app.ts`).

Original Windows desktop app for church scripture presentation. Inspired by Loghema/Pewbeam *functionality only* — no proprietary UI, branding, or assets.

## Goals

- Continuous listen → STT → scripture detection → local Bible DB → operator Preview/Live/Queue → vMix / browser overlay
- Strong Yoruba + English bilingual support
- Offline-capable Bible lookup and manual workflow
- Reliable, low-latency operator UX for church media volunteers

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Desktop shell | Electron + TypeScript + electron-builder | Native Windows packaging, secure main/renderer split |
| UI | React + Vite + TypeScript | Fast HMR, typed UI |
| Styling | Tailwind CSS + shadcn/ui + Lucide | Consistent primitives without inventing a design system |
| State | Zustand | Lightweight stores for live/preview/queue/settings |
| Persistence | SQLite via better-sqlite3 + SQL migrations | Local, fast verse lookup; no cloud DB required |
| IPC | Preload `contextBridge` + typed channels + Zod | No Node in renderer; validated payloads |
| Validation | Zod | Shared schemas for IPC and settings |
| Tests | Vitest (+ RTL later) | Unit/integration for detectors, Bible repo, settings |
| Logging | Structured logger (main) | Status/debug without logging secrets |

## Process model

```
┌─────────────┐  contextBridge / IPC   ┌──────────────────────┐
│  Renderer   │ ◄────────────────────► │  Main process        │
│  React UI   │   typed + Zod          │  SQLite, settings,   │
│  Zustand    │                        │  audio/STT, vMix,    │
└─────────────┘                        │  import, logger      │
                                       └──────────────────────┘
```

- `nodeIntegration: false`, `contextIsolation: true`
- Privileged work stays in main; renderer receives DTOs only

## Module map

```
src/main/
  audio/          device list, capture (Phase 4+)
  database/       migrations, connection, repositories
  scripture/      detectors, normalizers (Phase 3+)
  transcription/  SpeechToTextProvider (Phase 4+)
  vmix/           VmixOutputAdapter (Phase 6+)
  overlay/        local browser overlay server (Phase 6+)
  settings/       persisted settings
  sessions/       detection sessions / history
  ipc/            typed handlers
  security/       path/url guards

src/renderer/
  components/     layout + shadcn primitives
  features/       live, transcript, detection, bible, vmix, settings, history
  stores/         Zustand
  pages/          dashboard, settings

src/shared/       types, Zod schemas, constants, scripture IDs
resources/        bible sources, aliases, models
scripts/bible/    USFM/JSON import
```

## Swappable interfaces (Phase 1 stubs / later)

- `SpeechToTextProvider` — Google STT MVP; Whisper later
- `BibleRepository` — SQLite-backed (Phase 2)
- `ScriptureDetector` — direct → contextual → quotation → semantic
- `BroadcastOutput` — vMix HTTP/TCP; overlay
- `EmbeddingProvider` / `ReferenceInterpretationProvider` — optional, never core path

## Data flow (target)

Audio → Capture → Streaming STT → Transcript normalizer → Scripture detection (confidence/rank) → BibleRepository → Detection event → Operator dashboard → Output adapters

## Database (SQLite)

Migrations under `src/main/database/migrations/`.

Tables: `bible_translations`, `bible_books`, `bible_verses`, `book_aliases`, `detection_sessions`, `detections`, `settings`.

Canonical book IDs are language-neutral (`GEN`, `JHN`, `1CO`, …). Verses store `original_text` (display) and `normalized_text` (search).

## Security

- No unrestricted Node in renderer
- Credentials only in main (`GOOGLE_APPLICATION_CREDENTIALS` / secure storage) — never committed
- Validated IPC; no privileged arbitrary navigation
- Graceful degradation when STT/vMix/mic/network fail

## Phase boundary

Phases 1–2 ship foundation + Bible DB/import/manual lookup. Speech recognition, detection pipeline, vMix, and packaging are later phases — see [ROADMAP.md](./ROADMAP.md).
