# Security

## Electron

- `contextIsolation: true`
- `nodeIntegration: false`
- Preload exposes a narrow `window.verseflow` API only
- IPC payloads validated with Zod where settings are written
- External URLs open via `shell.openExternal`; window open handler denies in-app nav

## Secrets

- Never commit API keys or credential JSON
- Use `.env.example` only; real env files are gitignored
- Google STT credentials (Phase 4) stay in the main process via `GOOGLE_APPLICATION_CREDENTIALS` / secure storage
- Logger redacts common secret patterns

## Data

- Bible DB and settings live under Electron `userData` (or `VERSEFLOW_*` overrides)
- No audio recording by default (Phase 4+)
