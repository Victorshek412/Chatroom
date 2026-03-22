import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(__dirname, ".playwright");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command:
        'cmd /c "set E2E_BACKEND_PORT=3100&& set E2E_FRONTEND_ORIGIN=http://localhost:4173&& npm run e2e:mock-server --prefix ..\\backend"',
      url: "http://localhost:3100/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        'cmd /c "set VITE_API_URL=http://localhost:3100/api&& set VITE_SOCKET_URL=http://localhost:3100&& npm run dev -- --host localhost --port 4173 --strictPort"',
      url: "http://localhost:4173/login",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
