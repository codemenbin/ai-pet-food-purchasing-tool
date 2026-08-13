import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// 跨平台：检测 .env.local 是否存在，不存在则注入 DEMO/LLM_MOCK
const hasEnvLocal = existsSync(resolve(process.cwd(), ".env.local"));
const webServerEnv: Record<string, string> = hasEnvLocal ? {} : { DEMO_MODE: "1", LLM_MOCK: "1" };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node_modules\\.bin\\next.cmd dev -p ${PORT}`,
    env: webServerEnv,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
