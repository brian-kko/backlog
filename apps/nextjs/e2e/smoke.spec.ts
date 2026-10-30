import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import SuperJSON from "superjson";
import { z } from "zod/v4";

import {
  BacklogExportSchema,
  SearchDealsInputSchema,
  SteamFeedInputSchema,
  UpsertBacklogItemSchema,
} from "@acme/validators";

type Backup = z.infer<typeof BacklogExportSchema>;
const backup: Backup = {
  version: 1,
  exportedAt: "2026-10-22T12:00:00.000Z",
  items: [
    {
      steamAppId: 1091500,
      title: "Cyberpunk 2077",
      isOwned: true,
      amountPaid: 29.99,
    },
  ],
};
const titles: Record<number, string> = {
  1091500: "Cyberpunk 2077",
  1245620: "Elden Ring",
  553850: "Helldivers 2",
  1086940: "Baldur's Gate 3",
  730: "Counter-Strike 2",
  570: "Dota 2",
  1145360: "Hades",
};
function steamFeed(steamAppId: number) {
  const item = {
    steamAppId,
    cleanSummary: "Performance improvements and bug fixes.",
    url: `https://store.steampowered.com/news/app/${steamAppId}`,
    publishedAt: new Date("2026-10-22T12:00:00Z"),
    official: true,
  };
  return {
    patchNotes: [0, 1, 2].map((index) => ({
      ...item,
      id: `patch-${index}`,
      category: "patch_note" as const,
      title: `${titles[steamAppId] ?? steamAppId} Patch ${index + 1}`,
    })),
    events: [
      {
        ...item,
        id: "festival",
        category: "event" as const,
        title: "Night City Festival",
        cleanSummary: "Join the limited-time celebration.",
      },
      {
        ...item,
        id: "letter",
        official: false,
        category: "general" as const,
        title: "A letter from the developers",
        cleanSummary: "Thank you for playing.",
      },
    ],
  };
}
const deals = Array.from({ length: 12 }, (_, index) => ({
  id: `deal-${index}`,
  steamAppId: index === 11 ? null : index === 0 ? 1091500 : 1000 + index,
  title: index === 0 ? "Cyberpunk 2077" : `Featured Game ${index}`,
  cheapestPrice: index === 1 ? 9.99 : 29.99 + index,
  normalPrice: 59.99,
  savingsPercent: index < 2 ? 50 : 30,
  storeId: index % 3 === 0 ? "7" : index % 3 === 1 ? "1" : "25",
  steamRedeemable: index % 3 === 1,
  url: `https://www.cheapshark.com/redirect?dealID=deal-${index}`,
  thumb:
    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg",
}));
function fixturePrices(steamAppId: number) {
  return {
    title: titles[steamAppId] ?? "Game",
    currentPrice: 19.99,
    historicalLow: 14.99,
    source: "cheapshark",
    verifiedAt: "2026-10-29",
    deals: [
      {
        storeID: "1",
        dealID: "steam-deal",
        price: 19.99,
        retailPrice: 59.99,
        savings: 67,
        url: "https://www.cheapshark.com/redirect?dealID=steam-deal",
      },
    ],
  };
}
const browserErrors = new WeakMap<Page, string[]>();

// Browser integration uses the actual tRPC serialization protocol with deterministic
// upstream results, so tests do not depend on credentials, PostgreSQL, or live sales.
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    // React Query cancels unused queries on navigation; these are not API failures.
    if (
      request.url().includes("/api/trpc/") &&
      request.failure()?.errorText !== "net::ERR_ABORTED"
    )
      errors.push(`Failed tRPC request: ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/trpc/") && response.status() >= 400)
      errors.push(`tRPC HTTP ${response.status()}`);
  });
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: null }),
  );
  let accountItems = structuredClone(backup.items);
  const t = initTRPC.create({ transformer: SuperJSON });
  const router = t.router({
    backlog: t.router({
      getBacklog: t.procedure.query(() =>
        accountItems.map((item) => ({
          ...item,
          id: `item-${item.steamAppId}`,
          userId: "test-user",
          createdAt: new Date(),
          amountPaid: item.amountPaid ?? null,
          targetPrice: item.targetPrice ?? null,
          completionStatus: item.completionStatus ?? "backlog",
          notifyPatches: item.notifyPatches ?? true,
          notifyEvents: item.notifyEvents ?? true,
        })),
      ),
      exportBacklogJson: t.procedure
        .output(BacklogExportSchema)
        .query(() => ({ ...backup, items: accountItems })),
      importBacklogJson: t.procedure
        .input(BacklogExportSchema)
        .mutation(({ input }) => {
          accountItems = input.items;
          return { imported: input.items.length };
        }),
      removeBacklogItem: t.procedure
        .input(z.object({ steamAppId: z.number() }))
        .mutation(({ input }) => {
          accountItems = accountItems.filter(
            (item) => item.steamAppId !== input.steamAppId,
          );
          return { removed: input.steamAppId };
        }),
      searchDeals: t.procedure
        .input(SearchDealsInputSchema)
        .query(({ input }) => {
          if ((input?.page ?? 0) > 0) return [];
          let result = deals.filter(
            (deal) =>
              !input?.query ||
              deal.title.toLowerCase().includes(input.query.toLowerCase()),
          );
          if (input?.storeIds?.length)
            result = result.filter((deal) =>
              input.storeIds?.some((id) => id === deal.storeId),
            );
          if (input?.maxPrice !== undefined)
            result = result.filter(
              (deal) => deal.cheapestPrice <= input.maxPrice!,
            );
          if (input?.steamOnly)
            result = result.filter((deal) => deal.steamRedeemable);
          if (input?.onSale)
            result = result.filter((deal) => deal.savingsPercent > 0);
          return result;
        }),
      getGamePrices: t.procedure
        .input(z.object({ steamAppId: z.number() }))
        .query(({ input }) => ({ prices: fixturePrices(input.steamAppId) })),
      upsertBacklogItem: t.procedure
        .input(UpsertBacklogItemSchema)
        .mutation(({ input }) => {
          const previous = accountItems.find(
            (item) => item.steamAppId === input.steamAppId,
          );
          const item = {
            ...previous,
            ...input,
            isOwned: input.isOwned ?? previous?.isOwned ?? false,
            amountPaid: Object.hasOwn(input, "amountPaid")
              ? (input.amountPaid ?? undefined)
              : previous?.amountPaid,
            targetPrice: Object.hasOwn(input, "targetPrice")
              ? (input.targetPrice ?? undefined)
              : previous?.targetPrice,
          };
          accountItems = [
            ...accountItems.filter(
              (value) => value.steamAppId !== item.steamAppId,
            ),
            item,
          ];
          return item;
        }),
      getSteamFeed: t.procedure
        .input(SteamFeedInputSchema)
        .query(({ input }) => steamFeed(input.steamAppId ?? 1091500)),
      getGameDetails: t.procedure
        .input(z.object({ steamAppId: z.number() }))
        .query(({ input }) => ({
          steamAppId: input.steamAppId,
          feed: steamFeed(input.steamAppId),
          metadata: {
            name: titles[input.steamAppId] ?? `Steam App ${input.steamAppId}`,
            short_description: "A world waiting to be explored.",
          },
          prices: fixturePrices(input.steamAppId),
        })),
    }),
  });
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      router,
      createContext: () => ({}),
      req: new Request(request.url(), {
        method: request.method(),
        headers: await request.allHeaders(),
        ...(request.method() === "POST" ? { body: request.postData() } : {}),
      }),
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
});

test.afterEach(async ({ page }) => {
  expect(
    browserErrors.get(page),
    "Browser console, page errors, and failed tRPC requests",
  ).toEqual([]);
});

test("guest dashboard previews and persistent navigation cover all main routes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Backlog");
  await expect(page.getByText("You’re exploring in Guest Mode")).toBeVisible();
  for (const metric of [
    "Total Spent",
    "Owned Library",
    "Wishlist Alerts",
    "Estimated Value",
  ])
    await expect(page.getByText(metric, { exact: true })).toBeVisible();
  await expect(page.getByTestId("deal-card")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: /Jump Back In/ }),
  ).toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Latest Game Updates" }),
      })
      .getByRole("article"),
  ).toHaveCount(4);
  for (const [id, path, heading] of [
    ["deals", "/deals", "PC game deals"],
    ["library", "/library", "Your library"],
    ["wishlist", "/wishlist", "Your wishlist"],
    ["updates", "/updates", "Stay in the loop"],
    ["home", "/", "Dashboard"],
  ]) {
    await page.getByTestId(`nav-${id}`).click();
    await expect(page).toHaveURL(path ?? "/");
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("PC Companion: Web URI Mode")).toBeVisible();
  }
});

test("deals stack filters, show stores, sort offers, and save a wishlist", async ({
  page,
}) => {
  await page.goto("/deals");
  await expect(page.getByTestId("deal-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Under $15", exact: true }).click();
  await expect(page.getByTestId("deal-card")).toHaveCount(1);
  await page.getByRole("button", { name: "50%+ Off", exact: true }).click();
  await expect(page.getByTestId("deal-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Under $15", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "50%+ Off", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Steam Redeemable", exact: true })
    .click();
  await expect(page.getByTestId("deal-card")).toHaveCount(1);
  await page.getByLabel("Sort deals", { exact: true }).selectOption("price");
  await page.reload();
  await expect(page.getByTestId("deal-card")).toHaveCount(1);
  await expect(page.getByLabel("Sort deals", { exact: true })).toHaveValue(
    "price",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.getByTestId("deal-card")).toHaveCount(12);
  await page.locator(".store-picker summary").click();
  await page.getByLabel("GOG store", { exact: true }).check();
  await expect(page.getByTestId("deal-card")).toHaveCount(4);
  await page.getByLabel("Steam store", { exact: true }).check();
  await expect(page.getByTestId("deal-card")).toHaveCount(8);
  await page.getByLabel("Steam store", { exact: true }).uncheck();
  await expect(page.getByTestId("deal-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "All Deals", exact: true }).click();
  await page.getByTestId("deal-search-input").fill("Featured Game 1");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByTestId("deal-card")
    .first()
    .getByRole("button", { name: "+ Wishlist", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Featured Game 1 added to wishlist.",
  );
  await page.getByTestId("nav-wishlist").click();
  await expect(
    page.getByRole("heading", { name: "Featured Game 1", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Featured Game 1", exact: true }),
  ).toBeVisible();
});

test("guest library launches, filters, exports valid JSON, and imports backups", async ({
  page,
}) => {
  await page.goto("/library");
  await expect(
    page.getByText("Starter Demo Library (Sign in to sync your Steam account)"),
  ).toBeVisible();
  await expect(page.getByTestId("library-card")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: /Launch Game/ }).first(),
  ).toHaveAttribute("href", "steam://rungameid/1091500");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Baldur's Gate 3", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-json-btn").click();
  const download = await downloadPromise;
  const file = await download.path();
  if (!file) throw new Error("Backup was not downloaded");
  const payload = BacklogExportSchema.parse(
    JSON.parse(await readFile(file, "utf8")),
  );
  expect(payload.items.filter((item) => item.isOwned)).toHaveLength(3);
  expect(payload.items.some((item) => item.title === "Cyberpunk 2077")).toBe(
    true,
  );
  payload.items.push({
    steamAppId: 730,
    title: "Counter-Strike 2",
    isOwned: true,
    amountPaid: 0,
  });
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect(page.getByRole("status")).toHaveText(
    "Backlog imported successfully.",
  );
  await page.getByRole("button", { name: "All Games", exact: true }).click();
  await expect(page.getByTestId("library-card")).toHaveCount(4);
  await page.reload();
  await expect(page.getByTestId("library-card")).toHaveCount(4);
});

test("updates tabs, keyboard navigation, game pills and custom AppIDs", async ({
  page,
}) => {
  await page.goto("/updates");
  await expect(
    page.getByRole("heading", { name: "Cyberpunk 2077 Patch 1", exact: true }),
  ).toBeVisible();
  await page.getByTestId("tab-events").click();
  await expect(page.getByTestId("tab-events")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Night City Festival" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A letter from the developers" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Include community and press posts", { exact: true })
    .check();
  await expect(
    page.getByRole("heading", { name: "A letter from the developers" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cyberpunk 2077 Patch 1", exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("tab-events").press("ArrowLeft");
  await expect(page.getByTestId("tab-patches")).toBeFocused();
  await page
    .getByRole("button", { name: "Elden Ring [1245620]", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Elden Ring Patch 1", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Custom Steam AppID").fill("570");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dota 2 Patch 1", exact: true }),
  ).toBeVisible();
});

test("dynamic game hub displays prices, news, tracking and desktop launch", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__TAURI__ = {
      core: {
        invoke: (command, args) => {
          sessionStorage.setItem("launch", JSON.stringify({ command, args }));
          return Promise.resolve();
        },
      },
    };
  });
  await page.goto("/game/1091500");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cyberpunk 2077",
  );
  await expect(page.getByText("Desktop Connected")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Cyberpunk 2077 Steam header artwork" }),
  ).toHaveAttribute("src", /1091500\/header.jpg$/);
  await expect(page.getByTestId("launch-game-btn")).toHaveAttribute(
    "href",
    "steam://rungameid/1091500",
  );
  await page.getByTestId("launch-game-btn").click();
  expect(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem("launch") ?? "null") as unknown,
    ),
  ).toEqual({
    command: "plugin:opener|open_url",
    args: { url: "steam://rungameid/1091500" },
  });
  await expect(
    page.getByRole("heading", { name: "Best live price" }),
  ).toBeVisible();
  await page.getByTestId("tab-events").click();
  await expect(
    page.getByRole("heading", { name: "Night City Festival" }),
  ).toBeVisible();
  await page
    .getByLabel("Backlog completion status", { exact: true })
    .selectOption("completed");
  await expect(page.getByRole("status")).toHaveText("Backlog status updated.");
  await page.getByTestId("nav-library").click();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cyberpunk 2077", exact: true }),
  ).toBeVisible();
});

test("wishlist targets and notification preferences persist in guest mode", async ({
  page,
}) => {
  await page.goto("/wishlist");
  const watch = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Helldivers 2", exact: true }),
  });
  await expect(watch.locator('[data-alert-state="TARGET_MET"]')).toBeVisible();
  const toggle = page.getByRole("switch", {
    name: "Notify on Patch Notes for Helldivers 2",
    exact: true,
  });
  await toggle.uncheck();
  await page
    .getByLabel("Target price for Helldivers 2", { exact: true })
    .fill("5");
  await page
    .getByLabel("Target price for Helldivers 2", { exact: true })
    .press("Tab");
  await expect(watch.locator('[data-alert-state="WAIT"]')).toBeVisible();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await expect(
    page.getByLabel("Target price for Helldivers 2", { exact: true }),
  ).toHaveValue("5");
});

test("signed in library uses account data and exports the server backup", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "test-user",
          name: "Test Player",
          email: "player@example.com",
          emailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        session: {
          id: "test-session",
          userId: "test-user",
          token: "test-token",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      },
    }),
  );
  await page.goto("/library");
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await expect(
    page.getByText("Starter Demo Library (Sign in to sync your Steam account)"),
  ).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-json-btn").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("backlog-2026-10-22.json");
  const path = await download.path();
  if (!path) throw new Error("Missing download");
  expect(
    BacklogExportSchema.parse(JSON.parse(await readFile(path, "utf8"))),
  ).toEqual(backup);
  await page.getByTestId("nav-deals").click();
  await expect(page.getByTestId("deal-card")).toHaveCount(12);
  await page
    .getByTestId("deal-card")
    .nth(1)
    .getByRole("button", { name: "Mark Owned", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Featured Game 1 marked owned.",
  );
  await page.getByTestId("nav-library").click();
  await expect(page.getByTestId("library-card")).toHaveCount(2);
  const cyberpunk = page.getByTestId("library-card").filter({
    has: page.getByRole("heading", { name: "Cyberpunk 2077", exact: true }),
  });
  await cyberpunk
    .getByRole("link", { name: "Game Hub →", exact: true })
    .click();
  await page.getByLabel("Amount Paid ($)", { exact: true }).fill("12.34");
  await page.getByLabel("Amount Paid ($)", { exact: true }).press("Tab");
  await expect(page.getByRole("status")).toHaveText("Backlog status updated.");
  await page
    .getByLabel("Backlog completion status", { exact: true })
    .selectOption("completed");
  await expect(
    page.getByLabel("Backlog completion status", { exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "On Wishlist", exact: true }).click();
  await expect(page.getByTestId("nav-library")).toContainText("1");
  await expect(page.getByTestId("nav-wishlist")).toContainText("1");
  await page.getByLabel("Target Price ($)", { exact: true }).fill("7.50");
  await page.getByLabel("Target Price ($)", { exact: true }).press("Tab");
  await expect(
    page.getByRole("button", { name: "In Library", exact: true }),
  ).toBeEnabled();
  await page.getByTestId("nav-wishlist").click();
  await expect(
    page.getByLabel("Target price for Cyberpunk 2077", { exact: true }),
  ).toHaveValue("7.5");
  await page
    .getByLabel("Target price for Cyberpunk 2077", { exact: true })
    .fill("");
  await page
    .getByLabel("Target price for Cyberpunk 2077", { exact: true })
    .press("Tab");
  await expect(page.getByRole("status")).toHaveText("Price watch updated.");
  await page.reload();
  await expect(
    page.getByLabel("Target price for Cyberpunk 2077", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("link", { name: "Game Hub →", exact: true }).click();
  await page.getByRole("button", { name: "In Library", exact: true }).click();
  await expect(page.getByLabel("Amount Paid ($)", { exact: true })).toHaveValue(
    "12.34",
  );
  await expect(
    page.getByLabel("Backlog completion status", { exact: true }),
  ).toHaveValue("completed");
});

test("Game Hub ownership, completion and prices persist across pages with live nav counts", async ({
  page,
}) => {
  await page.goto("/game/1091500");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cyberpunk 2077",
  );
  await expect(
    page.getByRole("link", { name: "View on Steam ↗", exact: true }),
  ).toHaveAttribute("href", "https://store.steampowered.com/app/1091500/");
  await expect(
    page.getByText("Historical low: $14.99 · USD", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("nav-library")).toContainText("3");
  await expect(page.getByTestId("nav-wishlist")).toContainText("2");
  await page.getByLabel("Amount Paid ($)", { exact: true }).fill("12.34");
  await page.getByLabel("Amount Paid ($)", { exact: true }).press("Tab");
  await expect(page.getByRole("status")).toHaveText("Backlog status updated.");
  await page
    .getByLabel("Backlog completion status", { exact: true })
    .selectOption("completed");
  await page.getByTestId("nav-library").click();
  const card = page.getByTestId("library-card").filter({
    has: page.getByRole("heading", { name: "Cyberpunk 2077", exact: true }),
  });
  await expect(card.getByLabel("Amount paid for Cyberpunk 2077")).toHaveValue(
    "12.34",
  );
  await expect(
    card.getByLabel("Completion status for Cyberpunk 2077"),
  ).toHaveValue("completed");
  await card.getByRole("link", { name: "Game Hub →", exact: true }).click();
  await page.getByRole("button", { name: "On Wishlist", exact: true }).click();
  await expect(page.getByTestId("nav-library")).toContainText("2");
  await expect(page.getByTestId("nav-wishlist")).toContainText("3");
  await page.getByLabel("Target Price ($)", { exact: true }).fill("7.50");
  await page.getByLabel("Target Price ($)", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Backlog completion status", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "On Wishlist", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("nav-wishlist").click();
  await expect(
    page.getByLabel("Target price for Cyberpunk 2077", { exact: true }),
  ).toHaveValue("7.5");
  await page.reload();
  await expect(
    page.getByLabel("Target price for Cyberpunk 2077", { exact: true }),
  ).toHaveValue("7.5");
  await page.getByTestId("nav-home").click();
  await expect(
    page.locator(".metric-card").filter({ hasText: "Total Spent" }),
  ).toContainText("$99.98");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Owned Library" }),
  ).toContainText("2");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Estimated Value" }),
  ).toContainText("$99.95");
});

test("library search, removal undo, and owning a wishlist game keep purchase data honest", async ({
  page,
}) => {
  await page.goto("/library");
  await page.getByLabel("Find in your library", { exact: true }).fill("Elden");
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Remove Elden Ring from collection",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("library-card")).toHaveCount(0);
  await expect(
    page.getByText("Removed Elden Ring.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await expect(
    page.getByLabel("Amount paid for Elden Ring", { exact: true }),
  ).toHaveValue("39.99");
  await page.getByTestId("nav-wishlist").click();
  await page.getByLabel("Find in your wishlist", { exact: true }).fill("Hades");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Mark Owned", exact: true }).click();
  await page.getByTestId("nav-library").click();
  await page.getByLabel("Find in your library", { exact: true }).fill("Hades");
  await expect(
    page.getByLabel("Amount paid for Hades", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByText("Amount paid not recorded", { exact: true }),
  ).toBeVisible();
  await page.getByTestId("nav-home").click();
  await expect(
    page.locator(".metric-card").filter({ hasText: "Total Spent" }),
  ).toContainText("$129.97");
});

test("deal views, ownership filters and page controls survive refresh", async ({
  page,
}) => {
  await page.goto("/deals");
  await expect(page.getByTestId("deal-card")).toHaveCount(12);
  await page.getByLabel("Hide owned games", { exact: true }).check();
  await expect(page.getByTestId("deal-card")).toHaveCount(11);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".deal-grid-list")).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Hide owned games", { exact: true }),
  ).toBeChecked();
  await expect(page.locator(".deal-grid-list")).toBeVisible();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page.getByLabel("Offers per page", { exact: true }).selectOption("12");
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(
    page.getByText("No offers match this combination.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(page.getByTestId("deal-card")).toHaveCount(12);
});

for (const signedIn of [false, true]) {
  test(`${signedIn ? "account" : "guest"} Game Hub serializes price blur, membership changes and removal undo`, async ({
    page,
  }) => {
    if (signedIn)
      await page.route("**/api/auth/get-session**", (route) =>
        route.fulfill({
          json: {
            user: {
              id: "test-user",
              name: "Test Player",
              email: "player@example.com",
              emailVerified: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            session: {
              id: "test-session",
              userId: "test-user",
              token: "test-token",
              expiresAt: "2099-01-01T00:00:00.000Z",
            },
          },
        }),
      );
    const publicRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /\/api\/trpc\/.*backlog\.(getGameDetails|getGamePrices|getSteamFeed)/.test(
          request.url(),
        )
      )
        publicRequests.push(request.url());
    });
    await page.goto("/game/1091500");
    await expect(
      page.getByLabel("Amount Paid ($)", { exact: true }),
    ).toHaveValue("29.99");
    await expect(
      page.getByText("Historical low: $14.99 · USD", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Amount Paid ($)", { exact: true }),
    ).toBeEnabled();
    const initialRequests = publicRequests.length;
    await page.getByLabel("Amount Paid ($)", { exact: true }).fill("18.25");
    // Clicking directly blurs the field and changes membership in the same gesture.
    await page
      .getByRole("button", { name: "On Wishlist", exact: true })
      .click();
    await expect(
      page.getByLabel("Target Price ($)", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Backlog completion status", { exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Target Price ($)", { exact: true }).fill("7.50");
    await page.getByRole("button", { name: "In Library", exact: true }).click();
    await expect(
      page.getByLabel("Amount Paid ($)", { exact: true }),
    ).toHaveValue("18.25");
    await expect(page.locator(".save-state")).toContainText("Saved");
    expect(publicRequests).toHaveLength(initialRequests);
    await page.getByLabel("Amount Paid ($)", { exact: true }).fill("19.25");
    await page
      .getByRole("button", {
        name: "Remove Cyberpunk 2077 from collection",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Removed Cyberpunk 2077.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(
      page.getByLabel("Amount Paid ($)", { exact: true }),
    ).toHaveValue("19.25");
    await page.reload();
    await expect(
      page.getByLabel("Amount Paid ($)", { exact: true }),
    ).toHaveValue("19.25");
    await page
      .getByRole("button", { name: "On Wishlist", exact: true })
      .click();
    await expect(
      page.getByLabel("Target Price ($)", { exact: true }),
    ).toHaveValue("7.5");
  });
}
