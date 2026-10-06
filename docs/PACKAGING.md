# VerseFlow AI — Packaging (Phase 10)

Windows 10/11 x64 installer via **electron-builder** (NSIS). Mutable data never lives under Program Files.

## Build installer

```bash
npm install
npm run rebuild:native   # better-sqlite3 for Electron ABI
npm run bible:import     # optional: seed a DB for first-run copy workflows
npm run dist:win         # → release/VerseFlow AI-0.1.0-win-x64.exe
```

Dir unpack (no installer): `npm run pack` → `release/win-unpacked/`.

Packaging must run on a machine that can produce Windows targets (native deps). This repo does not commit secrets or credential JSON.

## AppData layout (writable)

Electron `userData` (typically `%APPDATA%\\VerseFlow AI\\` when packaged):

| Path | Purpose |
| --- | --- |
| `verseflow.db` | SQLite Bible + sessions |
| `settings.json` | Operator settings |
| `logs/` | Reserved for file logs |
| `.initialized` | First-launch marker |

Overrides (dev / IT):

- `VERSEFLOW_DATA_DIR` — replace userData root
- `VERSEFLOW_DB_PATH` — explicit DB file
- `VERSEFLOW_RESOURCES_DIR` — bundled resources root

## Bundled read-only resources

`extraResources` copies `resources/` (aliases, numbers, overlay HTML; **excludes** `bible/raw` downloads) next to the app as `resources/`. Resolved via `getResourcesRoot()` in main.

## First launch

On `app.whenReady`:

1. `ensureAppDataLayout()` creates dirs + `.initialized` if missing
2. Open DB under AppData (or override) and run migrations
3. Seed canonical books; verses appear after `bible:import` into that DB (or a future first-run import UI)
4. Load `settings.json` (defaults written on first settings access)

No audio or cloud credentials are required to open the operator UI. STT stays unavailable until `GOOGLE_APPLICATION_CREDENTIALS` is set in the environment (never baked into the installer).

## Design notes

- Prefer per-user NSIS (`perMachine: false`) so installs do not need admin write into Program Files for data
- `better-sqlite3` is listed in `asarUnpack` so the native `.node` loads correctly
- Program Files holds only the immutable app binary + bundled resources
- First-run *wizard polish* (guided Bible import UI) can iterate on top of `isFirstRun` from `ensureAppDataLayout()`
