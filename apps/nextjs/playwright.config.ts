import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    // Browser tests stub auth and API responses; no live credentials are needed.
    env: {
      AUTH_DISCORD_ID: "playwright-discord-id",
      AUTH_DISCORD_SECRET: "playwright-discord-secret",
      AUTH_SECRET: "playwright-only-auth-secret-at-least-32-characters",
      POSTGRES_URL: "postgresql://test:test@localhost:5432/backlog_test",
    },
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--disable-gpu"] },
      },
    },
  ],
});
