import path from "node:path";
import { app, BrowserWindow, shell } from "electron";
import { APP_NAME } from "../shared/constants/app";
import { openDatabase, closeDatabase } from "./database/connection";
import { BibleRepository } from "./database/BibleRepository";
import { registerIpcHandlers } from "./ipc/handlers";
import { loadSettings } from "./settings/store";
import { logger } from "./security/logger";

const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadPath = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: APP_NAME,
    backgroundColor: "#0b1220",
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5179";
    void mainWindow.loadURL(url);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const settings = loadSettings();
  logger.setLevel(settings.advanced.logLevel);
  logger.info(`${APP_NAME} starting`, { version: app.getVersion(), isDev });

  openDatabase();
  const repo = new BibleRepository(openDatabase());
  repo.seedCanonicalBooks();

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    closeDatabase();
    app.quit();
  }
});

app.on("before-quit", () => {
  closeDatabase();
});
