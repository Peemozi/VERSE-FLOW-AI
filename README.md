# VerseFlow AI

AI-powered church scripture presentation for Windows. Listens for spoken Bible references (English / Yoruba), resolves them against a local Bible database, and drives operator Preview/Live workflow toward vMix and a browser overlay.

**Phase status:** Phases 1–7 implemented (foundation through Yoruba hardening). Quotation/semantic detection and packaging come next.

## Stack

Electron · React · Vite · TypeScript · Tailwind · shadcn/ui · Zustand · SQLite (`better-sqlite3`) · Zod · Vitest

## Quick start

```bash
npm install
npm run rebuild:native   # if better-sqlite3 fails under Electron
npm run bible:import     # downloads public-domain WEB USFM into ./data/verseflow.db
npm run dev              # Vite :5179 + Electron
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev Electron + Vite |
| `npm run build` | Compile main + renderer |
| `npm run typecheck` | TypeScript across main/renderer/shared |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run bible:import` | Import WEB (+ OYCB if USFM provided) |

### Bible data

- **WEB** — World English Bible, public domain (auto-download from eBible.org)
- **OYCB** — Biblica Open Yoruba Contemporary Bible, CC BY-SA 4.0 (auto-download from eBible.org)

See [docs/BIBLE_DATA.md](docs/BIBLE_DATA.md). Raw downloads are gitignored.

## Speech

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm run dev
```

See [docs/TRANSCRIPTION.md](docs/TRANSCRIPTION.md). Without credentials, Listen stays unavailable; Simulation Mode and Bible lookup still work.

```bash
VERSEFLOW_DB_PATH=./data/verseflow.db npm run dev
```

By default the Electron app uses its `userData` directory. For local verification after import, set `VERSEFLOW_DB_PATH` (and optionally `VERSEFLOW_DATA_DIR`) to the same paths you imported into.

## App name

Configured centrally in `src/shared/constants/app.ts` as **VerseFlow AI**.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Bible data](docs/BIBLE_DATA.md)
- [Transcription](docs/TRANSCRIPTION.md)
- [vMix integration](docs/VMIX_INTEGRATION.md)
- [Yoruba support](docs/YORUBA_SUPPORT.md)
- [Testing](docs/TESTING.md)
- [Security](docs/SECURITY.md)
- [Third-party licences](THIRD_PARTY_LICENSES.md)

## Phases (next)

8 · Quotation detection  
9 · Semantic detection  
10 · Packaging (electron-builder)
