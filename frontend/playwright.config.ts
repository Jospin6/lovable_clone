import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const repository = path.resolve(__dirname, "..");

export default defineConfig({
  testDir: "./tests",
  outputDir: "../.test-artifacts/playwright",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
  },
  webServer: [
    {
      command: process.platform === "win32"
        ? "backend\\.venv\\Scripts\\python.exe -m uvicorn backend.tests.fixture_server:app --host 127.0.0.1 --port 8011"
        : "backend/.venv/bin/python -m uvicorn backend.tests.fixture_server:app --host 127.0.0.1 --port 8011",
      cwd: repository,
      url: "http://127.0.0.1:8011/api/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      env: { BACKEND_URL: "http://127.0.0.1:8011" },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
