import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");

const result = spawnSync(
  process.execPath,
  [path.join(frontendRoot, "node_modules", "playwright", "cli.js"), "install", "chromium"],
  {
    cwd: frontendRoot,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.join(frontendRoot, ".playwright"),
    },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
