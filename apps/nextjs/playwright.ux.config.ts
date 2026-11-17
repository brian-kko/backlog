import { defineConfig } from "@playwright/test";

/**
 * UX audit (not part of `test:e2e`): screenshots, axe-core, layout and
 * interaction checks across routes, viewports, themes and states, against a
 * production build so the service worker, performance and offline behaviour
 * are real. Output: ux/report/. See ux/RUBRIC.md.
 */
const port = Number(process.env.UX_PORT ?? 3100);

export default defineConfig({
  testDir: "./ux",
  outputDir: "./ux/report/.artifacts",
  fullyParallel: false,
  workers: 1,
  timeout: 10 * 60 * 1000,
  reporter: [["line"]],
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: { args: ["--disable-gpu"] },
  },
  webServer: {
    command: `pnpm with-env next build && pnpm with-env next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 6 * 60 * 1000,
  },
});
