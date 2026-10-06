import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS, type AppSettings } from "../../shared/constants/app";
import { parseSettings } from "../../shared/schemas";
import { getUserDataPath } from "../database/connection";
import { logger } from "../security/logger";

const SETTINGS_FILE = "settings.json";

function settingsPath(): string {
  return path.join(getUserDataPath(), SETTINGS_FILE);
}

export function loadSettings(): AppSettings {
  const file = settingsPath();
  try {
    if (!fs.existsSync(file)) {
      saveSettings(DEFAULT_SETTINGS);
      return structuredClone(DEFAULT_SETTINGS);
    }
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return parseSettings(raw);
  } catch (err) {
    logger.warn("Failed to load settings; using defaults", {
      error: err instanceof Error ? err.message : String(err),
    });
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const parsed = parseSettings(settings);
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(parsed, null, 2), "utf8");
  logger.setLevel(parsed.advanced.logLevel);
  return parsed;
}
