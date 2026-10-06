# Testing

## Commands

```bash
npm run test        # Vitest once
npm run typecheck   # tsc main + renderer + shared
npm run lint        # ESLint
npm run build       # main + renderer production build
```

## Current coverage (Phase 1–8)

- Settings Zod schema + defaults
- App name constant
- SQLite migrations shape
- `BibleRepository` get/search/seed
- USFM parser + marker stripping
- Yoruba diacritic normalization helper
- Reference parser: English direct, spoken numbers, ranges
- Contextual verse resolution + context TTL
- Invalid ref rejection + duplicate suppression
- Yoruba verified aliases (Johanu, Saamu, …)
- `ScriptureDetector` simulation pipeline with DB validation
- STT capabilities / bilingual honesty / reconnect backoff
- LiveSessionController finals → detector (fake provider)
- Unavailable provider without credentials
- Auto-live decision, operator shortcuts, history CSV/JSON export
- SessionHistoryRepository operator events
- Mock vMix HTTP/TCP: SetText URL encoding, title fields, Overlay In/Out
- OverlayServer: serve `/overlay`, LIVE state API, bilingual theme payload
- Yoruba hardening: OYCB aliases, numbers 1–176, ori/ese speech, diagnostics
- Quotation FTS5 match + suggestion gate (low conf not auto-live)
- Semantic stubs + async schedule (disabled by default)
- AppData layout helpers (`ensureAppDataLayout`)

## Later

- RTL for dashboard interactions
- Playwright smoke for Electron window
- Simulation-mode detection fixtures (Phase 3+)

## Native module note

`better-sqlite3` must match the Node version for Vitest and Electron ABI for the app:

```bash
npm run rebuild:native
```
