import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureAppDataLayout, getDbPath, getResourcesRoot } from "../../src/main/paths";

describe("AppData path helpers", () => {
  const prevData = process.env.VERSEFLOW_DATA_DIR;
  const prevDb = process.env.VERSEFLOW_DB_PATH;
  let tmp: string;

  afterEach(() => {
    if (prevData === undefined) delete process.env.VERSEFLOW_DATA_DIR;
    else process.env.VERSEFLOW_DATA_DIR = prevData;
    if (prevDb === undefined) delete process.env.VERSEFLOW_DB_PATH;
    else process.env.VERSEFLOW_DB_PATH = prevDb;
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("ensureAppDataLayout creates dirs and first-run marker under override", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vf-appdata-"));
    process.env.VERSEFLOW_DATA_DIR = tmp;
    delete process.env.VERSEFLOW_DB_PATH;

    const first = ensureAppDataLayout();
    expect(first.isFirstRun).toBe(true);
    expect(fs.existsSync(path.join(tmp, "logs"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, ".initialized"))).toBe(true);
    expect(first.dbPath).toBe(path.join(tmp, "verseflow.db"));

    const second = ensureAppDataLayout();
    expect(second.isFirstRun).toBe(false);
  });

  it("getDbPath honors VERSEFLOW_DB_PATH", () => {
    process.env.VERSEFLOW_DB_PATH = "/tmp/custom-verseflow.db";
    expect(getDbPath()).toBe("/tmp/custom-verseflow.db");
  });

  it("getResourcesRoot finds repo resources in tests", () => {
    const root = getResourcesRoot();
    expect(fs.existsSync(path.join(root, "overlay", "index.html"))).toBe(true);
  });
});
