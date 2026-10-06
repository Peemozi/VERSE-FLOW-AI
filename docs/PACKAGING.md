# VerseFlow AI — Packaging (Phase 10)

Windows 10/11 x64 installer via **electron-builder** (NSIS). Mutable data never lives under Program Files.

## Dev on a Windows church PC (before packaging)

Same machine as vMix — local Electron only (no cloud overlay host):

```bat
git clone <YOUR_REPO_URL>
cd <repo-folder>
git checkout cursor/verseflow-phase1-2-8ac8
npm install
npm run rebuild:native
npm run bible:import
npm run dev
```

If the Cursor remote is still **`agent_temp`**, create a real repo first (Create repo in Cursor), push branch `cursor/verseflow-phase1-2-8ac8`, then clone that URL on the church PC. Overlay binds `127.0.0.1:8791` inside the Electron process — see [VMIX_INTEGRATION.md](./VMIX_INTEGRATION.md).

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
5. `OutputController.startFromSettings()` starts the local overlay on `127.0.0.1:8791` when enabled

No audio or cloud credentials are required to open the operator UI. STT stays unavailable until `GOOGLE_APPLICATION_CREDENTIALS` is set in the environment (never baked into the installer).

## Design notes

- Prefer per-user NSIS (`perMachine: false`) so installs do not need admin write into Program Files for data
- `better-sqlite3` is listed in `asarUnpack` so the native `.node` loads correctly
- Program Files holds only the immutable app binary + bundled resources
- First-run *wizard polish* (guided Bible import UI) can iterate on top of `isFirstRun` from `ensureAppDataLayout()`
