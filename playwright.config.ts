import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120000,
    // The demo catalogue is dated October 2026. Judging it as of then keeps each match's state
    // fixed, so a dev server started without DEMO_NOW may fail these tests.
    env: { DEMO_NOW: "2026-10-05T12:00:00.000Z" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
