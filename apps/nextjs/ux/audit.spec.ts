import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserContextOptions, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/*
 * Gemuzu UX audit. Produces ux/report/{report.md,report.json,shots/*.png}
 * for reviewers to score against ux/RUBRIC.md. Run with:
 *   pnpm --filter @acme/nextjs ux:audit
 * Live Steam/CheapShark data is used, so prices vary between runs.
 */

const outDir = path.join(import.meta.dirname, "report");
const shotDir = path.join(outDir, "shots");
mkdirSync(shotDir, { recursive: true });

// "laptop" and "split" cover browsers that aren't full-screen: a small
// laptop and a window snapped to half of a 1680px display.
type ViewportName = "phone" | "tablet" | "split" | "laptop" | "desktop";
type Theme = "dark" | "light";
const viewports: Record<ViewportName, BrowserContextOptions> = {
  phone: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  tablet: { viewport: { width: 768, height: 1024 }, hasTouch: true },
  split: { viewport: { width: 840, height: 900 } },
  laptop: { viewport: { width: 1024, height: 720 } },
  desktop: { viewport: { width: 1440, height: 900 } },
};

const routes: [string, string][] = [
  ["dashboard", "/"],
  ["deals", "/deals"],
  ["library", "/library"],
  ["wishlist", "/wishlist"],
  ["updates", "/updates"],
  ["game-owned", "/game/1091500"],
  ["game-outside-collection", "/game/1422450"],
  ["patch-helldivers", "/patch/553850/1847920302234123"],
  ["patch-deadlock", "/patch/1422450/1848664643339845"],
];

interface PageAudit {
  id: string;
  route: string;
  viewport: ViewportName;
  theme: Theme;
  shot: string;
  axe: {
    impact: string;
    id: string;
    help: string;
    nodes: number;
    target: string;
  }[];
  overflowX: boolean;
  cls: number;
  lcpMs: number | null;
  smallTargets: { text: string; w: number; h: number; inline: boolean }[];
  tinyText: number;
  clipped: string[];
  headings: string[];
  headingIssues: string[];
  brokenImages: string[];
  consoleErrors: string[];
  failedRequests: string[];
}
interface Check {
  name: string;
  pass: boolean;
  detail: string;
  shot?: string;
}

const pages: PageAudit[] = [];
const checks: Check[] = [];

/** Collects console errors and failed requests for one page. */
function watch(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    // Navigation can cancel requests that the previous page no longer needs.
    if (failure && failure !== "net::ERR_ABORTED")
      failedRequests.push(`${failure} ${request.url().slice(0, 140)}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && !url.includes("/_next/webpack-hmr"))
      failedRequests.push(`${response.status()} ${url.slice(0, 140)}`);
  });
  return { consoleErrors, failedRequests };
}

async function newPage(
  browser: Browser,
  viewport: ViewportName,
  theme: Theme,
  reducedMotion: "reduce" | "no-preference" = "reduce",
) {
  const context = await browser.newContext({
    ...viewports[viewport],
    colorScheme: theme,
    reducedMotion,
  });
  const page = await context.newPage();
  return { context, page, log: watch(page) };
}

/** Waits for data to load and motion to settle. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
    /* long-polling or slow upstreams: measure what's there */
  });
  // Live price/news upstreams can be slow; wait for in-progress copy to clear.
  await page
    .waitForFunction(
      () =>
        !/\b(Loading|Finding offers|Comparing with Steam|Checking (prices|stores)|Searching)…/.test(
          document.querySelector("main")?.textContent ?? "",
        ),
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(800);
}

async function shoot(page: Page, name: string, fullPage = true) {
  const file = `${name}.png`;
  const viewport = page.viewportSize();
  // Playwright's fullPage capture briefly drops mobile/touch emulation, so
  // phones would be pictured with desktop pointer styles. Grow the viewport
  // to the page height instead and take a normal screenshot.
  if (fullPage && viewport) {
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.setViewportSize({ width: viewport.width, height });
    await page.waitForTimeout(200);
  }
  await page.screenshot({
    path: path.join(shotDir, file),
    caret: "initial",
    animations: "disabled",
  });
  if (fullPage && viewport) await page.setViewportSize(viewport);
  return `shots/${file}`;
}

/** In-page layout, typography and target measurements. */
function measure(page: Page, phone: boolean) {
  return page.evaluate(async (isPhone) => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        // Screen-reader-only text is clipped to 1px on purpose.
        rect.width > 1 &&
        rect.height > 1 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !element.closest(
          ".sr-only, [aria-hidden='true'], dialog:not([open]), details:not([open]) > :not(summary)",
        )
      );
    };
    const label = (element: Element) =>
      (
        element.getAttribute("aria-label") ??
        ((element as HTMLElement).innerText || element.tagName)
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 50);

    // Layout-shift and LCP entries are only exposed to buffered observers.
    const buffered = (type: string) =>
      new Promise<PerformanceEntry[]>((resolve) => {
        const entries: PerformanceEntry[] = [];
        const observer = new PerformanceObserver((list) =>
          entries.push(...list.getEntries()),
        );
        observer.observe({ type, buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(entries);
        }, 300);
      });
    const [shifts, paints] = await Promise.all([
      buffered("layout-shift"),
      buffered("largest-contentful-paint"),
    ]);
    let cls = 0;
    for (const entry of shifts as unknown as {
      hadRecentInput: boolean;
      value: number;
    }[])
      if (!entry.hadRecentInput) cls += entry.value;
    const lastPaint = paints.at(-1);
    const lcp = lastPaint ? Math.round(lastPaint.startTime) : null;

    const smallTargets: {
      text: string;
      w: number;
      h: number;
      inline: boolean;
    }[] = [];
    if (isPhone) {
      for (const element of document.querySelectorAll(
        "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]",
      )) {
        if (!visible(element)) continue;
        const target =
          element.matches("input") && element.closest("label")
            ? (element.closest("label") ?? element)
            : element;
        const rect = target.getBoundingClientRect();
        // Links inside running text only need 24px (WCAG 2.5.8 inline exception).
        // Only links that flow inside a sentence (inline, within a p/li with
        // more text than the link itself) count as running text.
        const parent = element.closest("p, li");
        const inline =
          element.matches("a, button.text-link") &&
          getComputedStyle(element).display === "inline" &&
          parent !== null &&
          parent.textContent.trim().length >
            element.textContent.trim().length + 12;
        // WCAG 2.5.8 exempts links inside running text entirely.
        if (inline) continue;
        const min = 44;
        if (rect.width < min - 0.5 || rect.height < min - 0.5)
          smallTargets.push({
            text: label(element),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            inline,
          });
      }
    }

    let tinyText = 0;
    const clipped: string[] = [];
    for (const element of document.querySelectorAll("body *")) {
      if (!visible(element)) continue;
      const style = getComputedStyle(element);
      const ownText = [...element.childNodes].some(
        (node) =>
          node.nodeType === Node.TEXT_NODE && node.textContent?.trim().length,
      );
      if (ownText && parseFloat(style.fontSize) < 12) tinyText++;
      const html = element as HTMLElement;
      if (
        ownText &&
        html.scrollWidth > html.clientWidth + 1 &&
        ["hidden", "clip"].includes(style.overflowX) &&
        style.textOverflow !== "ellipsis" &&
        style.webkitLineClamp === "none"
      )
        clipped.push(label(element));
    }

    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(visible)
      .map((element) => `${element.tagName.toLowerCase()} ${label(element)}`);
    const headingIssues: string[] = [];
    const levels = headings.map((value) => Number(value[1]));
    const h1s = levels.filter((level) => level === 1).length;
    if (h1s !== 1) headingIssues.push(`${h1s} h1 elements`);
    levels.forEach((level, index) => {
      const previous = levels[index - 1];
      if (index && previous && level > previous + 1)
        headingIssues.push(
          `skips h${previous} → h${level} at "${headings[index]}"`,
        );
    });

    const brokenImages = [...document.images]
      .filter(
        (image) => image.complete && image.naturalWidth === 0 && visible(image),
      )
      .map((image) => image.alt || image.src.slice(-60));

    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      cls: Math.round(cls * 1000) / 1000,
      lcpMs: lcp,
      smallTargets,
      tinyText,
      clipped: [...new Set(clipped)].slice(0, 10),
      headings,
      headingIssues,
      brokenImages,
    };
  }, phone);
}

async function auditPage(
  page: Page,
  log: ReturnType<typeof watch>,
  id: string,
  route: string,
  viewport: ViewportName,
  theme: Theme,
) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const metrics = await measure(page, viewport === "phone");
  const pageChecks = await page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };
    const accessibleName = (element: Element) => {
      const labelledBy = element.getAttribute("aria-labelledby");
      const referencedName = labelledBy
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
      const name = [
        element.getAttribute("aria-label"),
        referencedName,
        (element as HTMLElement).innerText,
        element.getAttribute("title"),
      ].find((value) => value && value.length > 0);
      return (name ?? "").trim().replace(/\s+/g, " ");
    };
    const price = document.querySelector(".watch-current-price, .deal-price");
    const heading = document.querySelector(".page-heading h1");
    const backLink = [...document.querySelectorAll("a.back-link")].find(
      visible,
    );
    const backName = backLink ? accessibleName(backLink) : "";
    return {
      priceFont: price ? getComputedStyle(price).fontFamily : null,
      headingFont: heading ? getComputedStyle(heading).fontFamily : null,
      backVisible: Boolean(backLink),
      backName,
    };
  });
  // Empty, offline and no-result states have no price to check.
  if ((route === "/deals" || route === "/wishlist") && pageChecks.priceFont) {
    const priceFont = pageChecks.priceFont;
    const headingFont = pageChecks.headingFont ?? "missing .page-heading h1";
    checks.push({
      name: `${id}: price uses IBM Plex Mono and page heading uses Barlow Condensed`,
      pass:
        priceFont.toLowerCase().includes("plex") &&
        headingFont.toLowerCase().includes("barlow"),
      detail: `price font=${priceFont}; heading font=${headingFont}`,
    });
  }
  if (route.startsWith("/game/") || route.startsWith("/patch/")) {
    checks.push({
      name: `${id}: detail page shows a named back link`,
      pass: pageChecks.backVisible && pageChecks.backName.length > 0,
      detail: pageChecks.backVisible
        ? `visible back-link name="${pageChecks.backName || "(empty)"}"`
        : "no visible a.back-link",
    });
  }
  if (
    (viewport === "desktop" || viewport === "laptop") &&
    (route === "/game/1091500" || route === "/game/1422450")
  ) {
    const expected = route === "/game/1091500";
    const actual = await page
      .locator(".hero-title")
      .evaluate((element) => element.classList.contains("has-logo"));
    // Recorded, not thrown, so one miss doesn't abort the whole audit.
    checks.push({
      name: `${id}: game title uses the expected logo treatment`,
      pass: actual === expected,
      detail: `${expected ? "Cyberpunk" : "Deadlock"}: expected has-logo=${expected}, got ${actual}`,
    });
  }
  const shot = await shoot(page, id);
  pages.push({
    id,
    route,
    viewport,
    theme,
    shot,
    axe: axe.violations.map((violation) => ({
      impact: violation.impact ?? "unknown",
      id: violation.id,
      help: violation.help,
      nodes: violation.nodes.length,
      target: String(violation.nodes[0]?.target[0] ?? ""),
    })),
    ...metrics,
    consoleErrors: [...log.consoleErrors],
    failedRequests: [...log.failedRequests],
  });
  log.consoleErrors.splice(0);
  log.failedRequests.splice(0);
}

test.describe.configure({ mode: "serial" });

test("routes × viewports × themes", async ({ browser }) => {
  const matrix: [ViewportName, Theme][] = [
    ["desktop", "dark"],
    ["tablet", "dark"],
    ["split", "dark"],
    ["laptop", "dark"],
    ["phone", "dark"],
    ["desktop", "light"],
    ["phone", "light"],
  ];
  for (const [viewport, theme] of matrix) {
    const { context, page, log } = await newPage(browser, viewport, theme);
    for (const [name, route] of routes) {
      await page.goto(route);
      await settle(page);
      await auditPage(
        page,
        log,
        `${viewport}-${theme}-${name}`,
        route,
        viewport,
        theme,
      );
    }
    await context.close();
  }
});

test("states: empty collection, filters, views, dialogs", async ({
  browser,
}) => {
  for (const viewport of ["desktop", "phone"] as const) {
    const { context, page, log } = await newPage(browser, viewport, "dark");
    const id = (name: string) => `${viewport}-dark-state-${name}`;

    // Library table view and status filter.
    await page.goto("/library");
    await settle(page);
    if (viewport === "desktop") {
      await page.getByRole("button", { name: "Table", exact: true }).click();
      await auditPage(
        page,
        log,
        id("library-table"),
        "/library",
        viewport,
        "dark",
      );
      await page.getByRole("button", { name: "Cards", exact: true }).click();
    }
    await page
      .getByRole("group", { name: "Filter by status" })
      .getByRole("button", { name: /Playing/ })
      .click();
    await auditPage(
      page,
      log,
      id("library-playing"),
      "/library",
      viewport,
      "dark",
    );

    // Deals: preset filter, then a search with no results.
    await page.goto("/deals");
    await settle(page);
    await page.getByRole("button", { name: "Under $15", exact: true }).click();
    await settle(page);
    // Live store prices can take a few seconds; count them once loaded.
    await page
      .getByText("Loading deals…")
      .waitFor({ state: "hidden", timeout: 20000 })
      .catch(() => undefined);
    // The filtered list can render after the loading text clears.
    await page
      .locator("[data-testid=deal-card] .deal-price")
      .first()
      .waitFor({ timeout: 20000 })
      .catch(() => undefined);
    const prices = await page
      .locator("[data-testid=deal-card] .deal-price")
      .allInnerTexts();
    const over = prices
      .map((value) => Number(value.replace(/[^0-9.]/g, "")))
      .filter((value) => value > 15);
    checks.push({
      name: `${viewport}: "Under $15" only shows offers ≤ $15 and keeps state in the URL`,
      pass: prices.length > 0 && over.length === 0 && page.url().includes("?"),
      detail: `${prices.length} offers, ${over.length} over $15, url ${new URL(page.url()).search}`,
    });
    await auditPage(
      page,
      log,
      id("deals-under-15"),
      "/deals",
      viewport,
      "dark",
    );
    await page.getByTestId("deal-search-input").fill("zzqx no such game");
    await page.getByTestId("deal-search-input").press("Enter");
    await settle(page);
    await auditPage(
      page,
      log,
      id("deals-no-results"),
      "/deals",
      viewport,
      "dark",
    );

    // Wishlist: edit a target and confirm the save is acknowledged.
    await page.goto("/wishlist");
    await settle(page);
    await page
      .getByRole("button", { name: "Edit target price for Helldivers 2" })
      .click();
    const field = page.getByLabel("Target price for Helldivers 2", {
      exact: true,
    });
    await field.fill("30");
    const started = Date.now();
    await field.press("Tab");
    const saved = await page
      .getByText("Target saved.")
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    checks.push({
      name: `${viewport}: editing a wishlist target confirms the save`,
      pass: saved,
      detail: saved
        ? `acknowledged in ${Date.now() - started} ms`
        : "no confirmation",
    });
    await auditPage(
      page,
      log,
      id("wishlist-edit-target"),
      "/wishlist",
      viewport,
      "dark",
    );

    // Add game dialog via keyboard shortcut (desktop) or button (phone).
    await page.goto("/");
    await settle(page);
    if (viewport === "desktop") await page.keyboard.press("/");
    else
      await page
        .getByRole("button", { name: "Add game", exact: true })
        .first()
        .click();
    const search = page.getByRole("dialog").getByLabel("Search games");
    const focused = await search.evaluate(
      (element) => element === document.activeElement,
    );
    await search.fill("hades");
    const searchStart = Date.now();
    const found = await page
      .getByRole("dialog")
      .getByText("Hades", { exact: true })
      .first()
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const searchMs = Date.now() - searchStart;
    await auditPage(page, log, id("add-game-dialog"), "/", viewport, "dark");
    await page.keyboard.press("Escape");
    const closed = await page
      .getByRole("dialog")
      .waitFor({ state: "hidden", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    checks.push({
      name: `${viewport}: Add game opens focused, finds "Hades", Escape closes`,
      pass: focused && found && closed,
      detail: `focused=${focused} found=${found} in ${searchMs} ms, closed=${closed}`,
    });

    await context.close();

    // Target edits turn samples into saved games; isolate empty captures from them.
    const {
      context: emptyContext,
      page: emptyPage,
      log: emptyLog,
    } = await newPage(browser, viewport, "dark");
    await emptyPage.addInitScript(() => {
      localStorage.setItem(
        "backlog-guest-v1",
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          items: [],
        }),
      );
      localStorage.removeItem("backlog-guest-sample");
    });
    for (const [name, route] of routes.slice(0, 5)) {
      await emptyPage.goto(route);
      await settle(emptyPage);
      const collectionCount = await emptyPage.evaluate(() => {
        const saved: unknown = JSON.parse(
          localStorage.getItem("backlog-guest-v1") ?? "null",
        );
        return saved &&
          typeof saved === "object" &&
          "items" in saved &&
          Array.isArray(saved.items)
          ? saved.items.length
          : null;
      });
      expect(collectionCount, `${name}: collection is empty`).toBe(0);
      if (["/library", "/wishlist", "/updates"].includes(route)) {
        await expect(emptyPage.locator("main .empty-state")).toBeVisible();
        await expect(
          emptyPage.locator(
            "[data-testid=library-card], .watch-card, .news-entry",
          ),
        ).toHaveCount(0);
      }
      await auditPage(
        emptyPage,
        emptyLog,
        id(`empty-${name}`),
        route,
        viewport,
        "dark",
      );
    }
    await emptyContext.close();
  }
});

test("states: loading, outage and offline", async ({ browser }) => {
  for (const viewport of ["desktop", "phone"] as const) {
    const id = (name: string) => `${viewport}-dark-state-${name}`;

    // Loading: hold price and news responses so in-progress states show.
    {
      const { context, page, log } = await newPage(browser, viewport, "dark");
      await page.route("**/api/trpc/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 6000));
        await route.continue().catch(() => undefined);
      });
      for (const [name, route] of [
        ["wishlist", "/wishlist"],
        ["dashboard", "/"],
      ]) {
        await page.goto(route ?? "/", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        await auditPage(
          page,
          log,
          id(`loading-${name}`),
          route ?? "/",
          viewport,
          "dark",
        );
      }
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await context.close();
    }

    // Partial outage: prices and news fail; the page should say so plainly.
    {
      const { context, page, log } = await newPage(browser, viewport, "dark");
      await page.route(
        /getGamePrices|getCollectionFeed|getSteamFeed/,
        (route) => route.fulfill({ status: 503, body: "{}" }),
      );
      for (const [name, route] of [
        ["wishlist", "/wishlist"],
        ["updates", "/updates"],
        ["game", "/game/1091500"],
      ]) {
        await page.goto(route ?? "/");
        await settle(page);
        await auditPage(
          page,
          log,
          id(`outage-${name}`),
          route ?? "/",
          viewport,
          "dark",
        );
      }
      await context.close();
    }

    // Offline: load once (service worker installs), then go offline.
    {
      const { context, page, log } = await newPage(browser, viewport, "dark");
      await page.goto("/wishlist");
      await settle(page);
      await page.waitForTimeout(1500);
      await context.setOffline(true);
      await page.reload().catch(() => undefined);
      await settle(page);
      const shellLoaded = await page
        .locator("main h1")
        .isVisible()
        .catch(() => false);
      // The cached shell must hydrate cleanly: a mismatch makes React
      // re-render the whole page and drop the theme class.
      const darkKept = await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      );
      const hydrationErrors = log.consoleErrors.filter((text) =>
        /Hydration|#418|didn't match/i.test(text),
      ).length;
      checks.push({
        name: `${viewport}: offline reload hydrates cleanly and keeps the theme`,
        pass: darkKept && hydrationErrors === 0,
        detail: `dark theme kept=${darkKept}, hydration errors=${hydrationErrors}`,
      });
      checks.push({
        name: `${viewport}: offline reload still shows the app shell and collection`,
        pass: shellLoaded,
        detail: shellLoaded
          ? "shell rendered from cache"
          : "browser offline page",
      });
      await auditPage(
        page,
        log,
        id("offline-wishlist"),
        "/wishlist",
        viewport,
        "dark",
      );
      await page
        .getByTestId("nav-deals")
        .click()
        .catch(() => undefined);
      await settle(page);
      await auditPage(
        page,
        log,
        id("offline-deals"),
        "/deals",
        viewport,
        "dark",
      );
      await context.close();
    }
  }
});

test("keyboard focus and motion", async ({ browser }) => {
  // Focus visibility across the first 25 tab stops on the dashboard.
  {
    const { context, page } = await newPage(browser, "desktop", "dark");
    await page.goto("/");
    await settle(page);
    const missing: string[] = [];
    for (let index = 0; index < 25; index++) {
      await page.keyboard.press("Tab");
      const result = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        // An element may draw its ring on a sibling (e.g. the masthead deck,
        // where the fixed hit area is invisible and the card shows focus).
        const proxy = element.dataset.focusProxy;
        const ringElement =
          (proxy ? element.parentElement?.querySelector(proxy) : null) ??
          element;
        const style = getComputedStyle(ringElement);
        const ring =
          (style.outlineStyle !== "none" &&
            parseFloat(style.outlineWidth) > 0) ||
          style.boxShadow !== "none";
        return {
          ring,
          name: (element.getAttribute("aria-label") ?? element.innerText)
            .trim()
            .slice(0, 40),
        };
      });
      if (result && !result.ring) missing.push(result.name);
      if (index === 6)
        await shoot(page, "desktop-dark-state-keyboard-focus", false);
    }
    checks.push({
      name: "desktop: every keyboard focus stop shows a visible indicator",
      pass: missing.length === 0,
      detail: missing.length
        ? `no indicator on: ${missing.join(", ")}`
        : "25 stops checked",
      shot: "shots/desktop-dark-state-keyboard-focus.png",
    });
    await context.close();
  }

  // Motion: reveals, nav indicator, count-up; nothing stuck hidden.
  {
    const { context, page } = await newPage(
      browser,
      "desktop",
      "dark",
      "no-preference",
    );
    await page.goto("/");
    await settle(page);
    const before = await page.evaluate(() => ({
      motionOk: document.documentElement.classList.contains("motion-ok"),
      pending: document.querySelectorAll("[data-reveal]:not([data-reveal-in])")
        .length,
      indicator: getComputedStyle(
        document.querySelector("nav") ?? document.body,
      )
        .getPropertyValue("--ind-w")
        .trim(),
    }));
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(1200);
    const stuck = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-reveal]")].filter(
          (element) => getComputedStyle(element).opacity !== "1",
        ).length,
    );
    await page.getByTestId("nav-deals").click();
    await page.waitForTimeout(600);
    const moved = await page.evaluate(() =>
      getComputedStyle(document.querySelector("nav") ?? document.body)
        .getPropertyValue("--ind-x")
        .trim(),
    );
    checks.push({
      name: "motion: reveals run and finish, nav indicator tracks the page",
      pass:
        before.motionOk &&
        stuck === 0 &&
        Boolean(before.indicator) &&
        Boolean(moved),
      detail: `motion-ok=${before.motionOk}, ${before.pending} below-fold reveals pending before scroll, ${stuck} stuck after, indicator w=${before.indicator} x(after nav)=${moved}`,
    });
    await context.close();
  }

  // Reduced motion: nothing animates in, everything visible immediately.
  {
    const { context, page } = await newPage(
      browser,
      "desktop",
      "dark",
      "reduce",
    );
    await page.goto("/");
    await settle(page);
    const hidden = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-reveal]")].filter(
          (element) => getComputedStyle(element).opacity !== "1",
        ).length,
    );
    checks.push({
      name: "reduced motion: all content visible without scrolling animations",
      pass: hidden === 0,
      detail: `${hidden} sections not fully visible`,
    });
    await context.close();
  }
});

test.afterAll(() => {
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), pages, checks },
      null,
      2,
    ),
  );
  const serious = (audit: PageAudit) =>
    audit.axe.filter(
      (value) => value.impact === "serious" || value.impact === "critical",
    );
  const gates = {
    "axe serious/critical": pages
      .filter((audit) => serious(audit).length)
      .map((audit) => audit.id),
    "horizontal overflow": pages
      .filter((audit) => audit.overflowX)
      .map((audit) => audit.id),
    "CLS ≥ 0.1": pages
      .filter((audit) => audit.cls >= 0.1)
      .map((audit) => `${audit.id} (${audit.cls})`),
    "console errors (non-simulated)": pages
      .filter(
        (audit) =>
          audit.consoleErrors.length > 0 &&
          !/outage|offline|loading/.test(audit.id),
      )
      .map((audit) => audit.id),
    "failed requests (non-simulated)": pages
      .filter(
        (audit) =>
          audit.failedRequests.length > 0 &&
          !/outage|offline|loading/.test(audit.id),
      )
      .map((audit) => audit.id),
    "broken images": pages
      .filter((audit) => audit.brokenImages.length)
      .map((audit) => audit.id),
    "phone targets below minimum": pages
      .filter((audit) => audit.smallTargets.length)
      .map((audit) => `${audit.id} (${audit.smallTargets.length})`),
    "clipped text": pages
      .filter((audit) => audit.clipped.length)
      .map((audit) => audit.id),
    "heading structure": pages
      .filter((audit) => audit.headingIssues.length)
      .map((audit) => audit.id),
    "interaction checks failing": checks
      .filter((check) => !check.pass)
      .map((check) => check.name),
  };
  const lines = [
    "# Gemuzu UX audit",
    "",
    `Generated ${new Date().toISOString()} · ${pages.length} page captures · ${checks.length} interaction checks. Score against \`ux/RUBRIC.md\`.`,
    "",
    "## Automated gates",
    "",
    ...Object.entries(gates).map(
      ([name, failing]) =>
        `- ${failing.length ? "❌" : "✅"} **${name}**${failing.length ? `: ${failing.slice(0, 12).join(", ")}${failing.length > 12 ? ` … (+${failing.length - 12})` : ""}` : ""}`,
    ),
    "",
    "## Interaction checks",
    "",
    ...checks.map(
      (check) =>
        `- ${check.pass ? "✅" : "❌"} ${check.name}: ${check.detail}${check.shot ? ` (${check.shot})` : ""}`,
    ),
    "",
    "## Pages",
    "",
    "| Capture | axe (serious+) | other axe | overflow | CLS | LCP ms | small targets | tiny text | clipped | console | screenshot |",
    "|---|---:|---:|:-:|---:|---:|---:|---:|---:|---:|---|",
    ...pages.map(
      (audit) =>
        `| ${audit.id} | ${serious(audit).length} | ${audit.axe.length - serious(audit).length} | ${audit.overflowX ? "❌" : "✓"} | ${audit.cls} | ${audit.lcpMs ?? "–"} | ${audit.smallTargets.length} | ${audit.tinyText} | ${audit.clipped.length} | ${audit.consoleErrors.length} | ${audit.shot} |`,
    ),
    "",
    "## Details",
    "",
    ...pages.flatMap((audit) => {
      const notes = [
        ...audit.axe.map(
          (value) =>
            `  - axe ${value.impact} \`${value.id}\` ×${value.nodes}: ${value.help} (e.g. \`${value.target}\`)`,
        ),
        ...audit.smallTargets
          .slice(0, 8)
          .map(
            (value) =>
              `  - small target "${value.text}" ${value.w}×${value.h}${value.inline ? " (inline)" : ""}`,
          ),
        ...audit.clipped.map((value) => `  - clipped text: "${value}"`),
        ...audit.headingIssues.map((value) => `  - headings: ${value}`),
        ...audit.brokenImages.map((value) => `  - broken image: ${value}`),
        ...audit.consoleErrors
          .slice(0, 4)
          .map((value) => `  - console: ${value.slice(0, 160)}`),
        ...audit.failedRequests
          .slice(0, 4)
          .map((value) => `  - request: ${value}`),
      ];
      return notes.length ? [`- **${audit.id}**`, ...notes] : [];
    }),
  ];
  writeFileSync(path.join(outDir, "report.md"), `${lines.join("\n")}\n`);
  expect(pages.length).toBeGreaterThan(0);
});
