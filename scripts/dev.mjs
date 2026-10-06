import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import waitOn from "wait-on";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const vite = spawn("npx", ["vite", "--config", "vite.config.ts"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: { ...process.env },
});

async function startElectron() {
  await waitOn({ resources: ["http-get://127.0.0.1:5179"], timeout: 60000 });

  // Ensure main is compiled
  await new Promise((resolve, reject) => {
    const tsc = spawn("npx", ["tsc", "-p", "tsconfig.main.json"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    tsc.on("exit", (code) => (code === 0 ? resolve(undefined) : reject(new Error(`tsc exited ${code}`))));
  });

  const electron = spawn("npx", ["electron", "."], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: "development",
      VITE_DEV_SERVER_URL: "http://127.0.0.1:5179",
    },
  });

  const shutdown = () => {
    electron.kill();
    vite.kill();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  electron.on("exit", () => {
    vite.kill();
    process.exit(0);
  });
}

startElectron().catch((err) => {
  console.error(err);
  vite.kill();
  process.exit(1);
});
