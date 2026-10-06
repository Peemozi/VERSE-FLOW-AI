import fs from "node:fs";
import path from "node:path";
import { APP_ID, APP_NAME } from "../shared/constants/app";

/**
 * Path helpers for packaged vs dev.
 * Packaged Windows installs write under Electron userData
 * (typically %APPDATA%\\VerseFlow AI\\) — never under Program Files.
 */

export function isPackagedApp(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require("electron") as { app?: { isPackaged?: boolean } };
    return Boolean(electron.app?.isPackaged);
  } catch {
    return false;
  }
}

export function getUserDataPath(): string {
  if (process.env.VERSEFLOW_DATA_DIR) {
    return process.env.VERSEFLOW_DATA_DIR;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require("electron") as {
      app?: { getPath: (name: string) => string; setName?: (n: string) => void };
    };
    if (electron.app?.getPath) {
      return electron.app.getPath("userData");
    }
  } catch {
    // outside Electron
  }
  return path.join(process.cwd(), "data");
}

export function getLogsDir(): string {
  return path.join(getUserDataPath(), "logs");
}

export function getDbPath(): string {
  if (process.env.VERSEFLOW_DB_PATH) return process.env.VERSEFLOW_DB_PATH;
  // When an explicit data dir is set, keep the DB inside it (tests / IT overrides)
  if (process.env.VERSEFLOW_DATA_DIR) {
    return path.join(process.env.VERSEFLOW_DATA_DIR, "verseflow.db");
  }
  // Dev convenience: reuse ./data/verseflow.db when present and not packaged
  if (!isPackagedApp()) {
    const localDevDb = path.join(process.cwd(), "data", "verseflow.db");
    if (fs.existsSync(localDevDb)) return localDevDb;
  }
  return path.join(getUserDataPath(), "verseflow.db");
}

/** Bundled read-only assets (aliases, overlay, bible demos). */
export function getResourcesRoot(): string {
  if (process.env.VERSEFLOW_RESOURCES_DIR) {
    return process.env.VERSEFLOW_RESOURCES_DIR;
  }
  if (isPackagedApp()) {
    // electron-builder extraResources → process.resourcesPath/resources
    return path.join(process.resourcesPath, "resources");
  }
  const candidates = [
    path.join(process.cwd(), "resources"),
    path.join(__dirname, "../../../resources"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]!;
}

export interface AppDataLayout {
  root: string;
  dbPath: string;
  settingsPath: string;
  logsDir: string;
  resourcesRoot: string;
  isFirstRun: boolean;
  isPackaged: boolean;
}

const INIT_MARKER = ".initialized";

/**
 * Ensure AppData directories exist. Marks first launch for future wizard UX.
 * Does not download Bible data (operator runs import or ships a prebuilt DB).
 */
export function ensureAppDataLayout(): AppDataLayout {
  const root = getUserDataPath();
  const logsDir = getLogsDir();
  const settingsPath = path.join(root, "settings.json");
  const dbPath = getDbPath();
  const marker = path.join(root, INIT_MARKER);

  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const isFirstRun = !fs.existsSync(marker);
  if (isFirstRun) {
    fs.writeFileSync(
      marker,
      JSON.stringify(
        {
          app: APP_NAME,
          appId: APP_ID,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  return {
    root,
    dbPath,
    settingsPath,
    logsDir,
    resourcesRoot: getResourcesRoot(),
    isFirstRun,
    isPackaged: isPackagedApp(),
  };
}
