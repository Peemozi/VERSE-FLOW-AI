# Testing

## Commands

```bash
npm run test        # Vitest once
npm run typecheck   # tsc main + renderer + shared
npm run lint        # ESLint
npm run build       # main + renderer production build
```

## Current coverage (Phase 1–2)

- Settings Zod schema + defaults
- App name constant
- SQLite migrations shape
- `BibleRepository` get/search/seed
- USFM parser + marker stripping
- Yoruba diacritic normalization helper

## Later

- RTL for dashboard interactions
- Playwright smoke for Electron window
- Simulation-mode detection fixtures (Phase 3+)

## Native module note

`better-sqlite3` must match the Node version for Vitest and Electron ABI for the app:

```bash
npm run rebuild:native
```
