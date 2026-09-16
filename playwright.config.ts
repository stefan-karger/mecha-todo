import { defineConfig, devices } from "@playwright/test";

const releaseEvidence = /tests[\\/]e2e[\\/](release-gates|visual-review)\.spec\.ts/;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-chrome",
      testMatch: releaseEvidence,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
    {
      name: "tablet-chrome",
      testMatch: releaseEvidence,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 768, height: 1024 },
        hasTouch: true,
      },
    },
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run build:playwright && npm run preview:playwright -- --host 127.0.0.1 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174/repository.js",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
