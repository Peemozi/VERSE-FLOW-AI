# VerseFlow AI — Roadmap

Phased delivery. Check items when implemented and verified.

## Phase 1 — Foundation

- [x] Electron + React + Vite + TypeScript scaffold
- [x] Tailwind + shadcn/ui + Lucide
- [x] Zustand stores (app/settings placeholders)
- [x] SQLite + better-sqlite3 + migration runner (base schema)
- [x] Typed IPC via preload + contextBridge + Zod
- [x] Structured logging (no secrets)
- [x] Configurable app name (`VerseFlow AI`)
- [x] Settings persistence (main + renderer)
- [x] Operator dashboard UI with placeholder panels (no fake STT)
- [x] Lint / typecheck / Vitest / build scripts
- [x] `docs/ARCHITECTURE.md`, this roadmap, README

## Phase 2 — Bible database

- [x] Canonical books + migrations (`bible_*`, aliases, detections, settings)
- [x] WEB (World English Bible) import — public domain
- [x] OYCB import path — licence-permitted sources only
- [x] `BibleRepository` (get verse, search, list translations/books)
- [x] Manual lookup / search in UI
- [x] `npm run bible:import`
- [x] Import/repository tests
- [x] `docs/BIBLE_DATA.md` + licence attribution

## Phase 3 — Reference parser + simulation

- [x] Direct reference parser (EN)
- [x] Transcript / Yoruba / number normalizers
- [x] Book alias engine (EN full + careful YO verified set)
- [x] Context tracking + contextual verse/chapter parsing
- [x] Verse ranges + validation (structure + optional DB)
- [x] Confidence scoring + duplicate suppression
- [x] Simulation mode (type transcript → same pipeline)
- [x] Unit tests: English direct, context, invalid, duplicate; Yoruba verified aliases
- [x] No live speech yet

## Phase 4 — Live speech

- [x] Audio device list + selection + real-time level meter
- [x] No-input / mute warning
- [x] `SpeechToTextProvider` interface + Google Cloud streaming STT (main only)
- [x] Language modes EN / YO / Bilingual with honest capability reporting
- [x] Interim + final transcripts; finals → Phase 3 `ScriptureDetector`
- [x] Provider status + reconnect/backoff (no crash on STT/mic loss)
- [x] `.env.example` for `GOOGLE_APPLICATION_CREDENTIALS`
- [x] `docs/TRANSCRIPTION.md`
- [x] Unit tests (capabilities, backoff, finals→detector, unavailable provider)
- [ ] Whisper provider — architect stub only (not implemented)

## Phase 5 — Operator workflow

- [ ] Preview / Queue / Live / History
- [ ] Assisted vs Automatic mode
- [ ] Shortcuts (Space/Enter/Esc/Ctrl+K/…)
- [ ] CLEAR LIVE always available
- [ ] Duplicate suppression

## Phase 6 — vMix + browser overlay

- [ ] `VmixOutputAdapter` (HTTP 8088 / TCP 8099)
- [ ] Test Connection + title field mapping
- [ ] Local overlay + WebSocket themes
- [ ] Session export CSV/JSON (no audio)

## Phase 7 — Yoruba hardening

- [ ] `yorubaNormalizer.ts` (match vs display)
- [ ] Book aliases EN/YO (editable)
- [ ] Number normalizers EN/YO
- [ ] `docs/YORUBA_SUPPORT.md`

## Phase 8 — Quotation detection

- [ ] FTS5 quotation search
- [ ] Suggestion UX unless high confidence

## Phase 9 — Semantic detection

- [ ] Optional embeddings — never block direct path
- [ ] Only after Phases 1–8 are solid

## Phase 10 — Packaging

- [ ] electron-builder Windows x64
- [ ] AppData paths for DB / settings / logs
- [ ] First-run wizard polish

## Docs checklist

| Doc | Status |
| --- | --- |
| README.md | Done (Phase 1–2) |
| docs/ARCHITECTURE.md | Done |
| docs/ROADMAP.md | Done |
| docs/BIBLE_DATA.md | Done (Phase 2) |
| docs/TESTING.md | Done (Phase 1–2) |
| docs/YORUBA_SUPPORT.md | Deferred (Phase 7) |
| docs/VMIX_INTEGRATION.md | Deferred (Phase 6) |
| docs/TRANSCRIPTION.md | Done (Phase 4) |
| docs/SECURITY.md | Stub (Phase 1) |
| THIRD_PARTY_LICENSES.md | Done (Phase 2) |
