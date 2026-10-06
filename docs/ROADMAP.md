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

- [x] Recent Detections / Preview / Queue / Live / Clear Live
- [x] Assisted (default) vs Automatic mode (min auto-live confidence)
- [x] Manual Bible search Ctrl/Cmd+K fully wired
- [x] Shortcuts: Space, Enter, Esc, Ctrl/Cmd+K, arrows, P, Q, L (ignored in inputs)
- [x] Session history page + CSV/JSON export (no audio)
- [x] LIVE unmistakable; CLEAR LIVE always available
- [x] Duplicate suppression (from Phase 3, still active)

## Phase 6 — vMix + browser overlay

- [x] `VmixOutputAdapter` (HTTP 8088 / TCP 8099)
- [x] Test Connection + title field mapping + SetText URL-encoded
- [x] Optional auto OverlayInputN In/Out on Send / Clear Live
- [x] Local overlay HTTP + WebSocket themes (Clean Lower Third, Full Scripture, Minimal, Bilingual)
- [x] Wire Phase 5 Send Live / Clear Live → OutputController
- [x] Mock vMix server for Vitest
- [x] `docs/VMIX_INTEGRATION.md`
- [x] Session export CSV/JSON (operator history — Phase 5; still available)

## Phase 7 — Yoruba hardening

- [x] `yorubaNormalizer.ts` (match vs display; underdot fold)
- [x] Book aliases EN/YO from OYCB metadata + `_uncertain` / `_asr` tiers
- [x] Number normalizers EN/YO (1–176; reviewer-correctable JSON)
- [x] Yoruba detection tests (verified aliases only)
- [x] Developer diagnostics screen
- [x] `docs/YORUBA_SUPPORT.md`

## Phase 8 — Quotation detection

- [x] FTS5 quotation search (`bible_verses_fts`)
- [x] Transcript sentence buffer + min length / generic-phrase gates
- [x] Lexical ranking + confidence; suggestions unless high bar
- [x] Runs after direct path (does not block)
- [x] `shouldAutoLive` higher threshold for `quotation`
- [x] Unit tests (match + low-confidence not auto-live)

## Phase 9 — Semantic detection

- [x] `EmbeddingProvider` + no-op stub (default)
- [x] `SemanticMatcher` async/schedule path — never blocks direct
- [x] `ReferenceInterpretationProvider` interface + DB validation helper
- [x] Settings toggle `semanticEnabled` (default OFF)
- [x] `docs/SEMANTIC_SEARCH.md`

## Phase 10 — Packaging

- [x] electron-builder Windows x64 (NSIS) via `npm run dist:win`
- [x] AppData paths for DB / settings / logs (`ensureAppDataLayout`)
- [x] First-launch marker + packaging docs (`docs/PACKAGING.md`)
- [ ] Guided first-run Bible import wizard UI (follow-up polish)
## Docs checklist

| Doc | Status |
| --- | --- |
| README.md | Done (Phase 1–2) |
| docs/ARCHITECTURE.md | Done |
| docs/ROADMAP.md | Done |
| docs/BIBLE_DATA.md | Done (Phase 2) |
| docs/TESTING.md | Done (Phase 1–2) |
| docs/YORUBA_SUPPORT.md | Done (Phase 7) |
| docs/VMIX_INTEGRATION.md | Done (Phase 6) |
| docs/TRANSCRIPTION.md | Done (Phase 4) |
| docs/SEMANTIC_SEARCH.md | Done (Phase 9) |
| docs/PACKAGING.md | Done (Phase 10) |
| docs/SECURITY.md | Stub (Phase 1) |
| THIRD_PARTY_LICENSES.md | Done (Phase 2) |
