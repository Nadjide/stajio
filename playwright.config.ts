import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";

const baseURL = "http://127.0.0.1:3101";
const runtimeName = `.stajio-e2e-${randomUUID()}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [[process.env.CI ? "github" : "list"], ["./tests/support/e2e-cleanup-reporter.mjs", { runtimeName }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `"${process.execPath}" "${path.resolve("tests/support/e2e-server.mjs")}"`,
    url: baseURL,
    reuseExistingServer: false,
    env: { STAJIO_E2E_RUNTIME_NAME: runtimeName },
    timeout: 120_000,
  },
});
