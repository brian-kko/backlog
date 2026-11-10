import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import SuperJSON from "superjson";
import { z } from "zod/v4";

import {
  BacklogExportSchema,
  CollectionFeedInputSchema,
  GameSearchInputSchema,
  parsePatchNotes,
  PatchNotesInputSchema,
  SearchDealsInputSchema,
  SteamFeedInputSchema,
  summarizePatch,
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
    available: true,
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
    historicalLowSource: "cheapshark",
    steamPrice: 24.99,
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
function searchFixtureDeals(input: z.infer<typeof SearchDealsInputSchema>) {
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
    result = result.filter((deal) => deal.cheapestPrice <= input.maxPrice!);
  if (input?.steamOnly) result = result.filter((deal) => deal.steamRedeemable);
  if (input?.onSale) result = result.filter((deal) => deal.savingsPercent > 0);
  return result;
}
const patchPost = `[h3]Stratagems[/h3][p][i]AMW-20 APEX[/i][/p][p]Problem we want to solve:[/p][list][*]Demolition strength was too low[/*][/list][p]Changes:[/p][list][*]Decreased caliber from 60 to 20[/*][*]Increased demolition strength to 30[/*][/list][p][i]SG-22 BUSHWACKER[/i][/p][list][*]Increased damage from 405 to 486[/*][/list][h3]Fixes[/h3][list][*]Fixed a crash when joining a squad[/*][/list]`;
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
          purchaseStore: item.purchaseStore ?? null,
          platform: item.platform ?? null,
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
      importGuestItems: t.procedure
        .input(BacklogExportSchema)
        .mutation(({ input }) => {
          const fresh = input.items.filter(
            (item) =>
              !accountItems.some(
                (value) => value.steamAppId === item.steamAppId,
              ),
          );
          accountItems = [...accountItems, ...fresh];
          return {
            added: fresh.length,
            skipped: input.items.length - fresh.length,
          };
        }),
      searchGames: t.procedure
        .input(GameSearchInputSchema)
        .query(({ input }) => ({
          source: "steam" as const,
          results: Object.entries(titles)
            .filter(([, title]) =>
              title.toLowerCase().includes(input.query.toLowerCase()),
            )
            .map(([id, title]) => ({
              steamAppId: Number(id),
              title,
              image: "",
              price: 19.99,
            })),
        })),
      getCollectionFeed: t.procedure
        .input(CollectionFeedInputSchema)
        .query(({ input }) => ({
          unavailable: [],
          items: input.steamAppIds
            .flatMap((id) => {
              const feed = steamFeed(id);
              return [...feed.patchNotes, ...feed.events].map((item) => ({
                ...item,
                id: `${id}-${item.id}`,
              }));
            })
            .filter((item) => item.official)
            .slice(0, input.limit),
        })),
      removeBacklogItem: t.procedure
        .input(z.object({ steamAppId: z.number() }))
        .mutation(({ input }) => {
          accountItems = accountItems.filter(
            (item) => item.steamAppId !== input.steamAppId,
          );
          return { removed: input.steamAppId };
        }),
      getPatchNotes: t.procedure
        .input(PatchNotesInputSchema)
        .query(({ input }) => {
          const patch = parsePatchNotes(patchPost, "Devoid of Liberty: 7.2.2");
          return {
            steamAppId: input.steamAppId,
            gid: input.gid,
            title: "Devoid of Liberty: 7.2.2",
            url: "https://store.steampowered.com/news/app/553850",
            publishedAt: new Date("2026-10-29T12:00:00Z"),
            patch,
            summary: summarizePatch(patch),
            aiAvailable: true,
          };
        }),
      getPatchAiSummary: t.procedure.input(PatchNotesInputSchema).query(() => ({
        overview: "A small balance patch that makes two Stratagems hit harder.",
        highlights: ["Bushwacker damage up to 486"],
        subjects: [{ name: "AMW-20 APEX", group: "buff" as const }],
      })),
      getSteamPrices: t.procedure
        .input(z.object({ steamAppIds: z.array(z.number()) }))
        .query(({ input }) =>
          Object.fromEntries(input.steamAppIds.map((id) => [id, 39.99])),
        ),
      searchDeals: t.procedure
        .input(SearchDealsInputSchema)
        .query(({ input }) =>
          // "saved" simulates a store outage answered from the saved catalog.
          input?.query === "saved"
            ? {
                live: false,
                snapshotAt: "2026-10-29",
                offers: searchFixtureDeals({ ...input, query: "" })
                  .slice(1, 3)
                  .map((deal) => ({ ...deal, source: "catalog" as const })),
              }
            : {
                live: true,
                snapshotAt: null,
                offers: searchFixtureDeals(input),
              },
        ),

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
            purchaseStore: Object.hasOwn(input, "purchaseStore")
              ? (input.purchaseStore ?? undefined)
              : previous?.purchaseStore,
            platform: Object.hasOwn(input, "platform")
              ? (input.platform ?? undefined)
              : previous?.platform,
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
  await expect(
    page.getByText("You’re exploring with sample games"),
  ).toBeVisible();
  for (const metric of [
    "Playing now",
    "Unplayed",
    "Price alerts",
    "Total spent",
  ])
    await expect(
      page.locator(".metric-card dt").getByText(metric, { exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Price watch" }),
  ).toBeVisible();
  await expect(page.locator(".watch-row")).toHaveCount(2);
  await expect(
    page.locator(".watch-row").first().locator(".watch-row-meta"),
  ).toContainText("less than Steam");
  await expect(page.getByRole("heading", { name: "Play next" })).toBeVisible();
  await expect(page.locator(".queue-card")).toHaveCount(2);
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "What changed" }) })
      .getByRole("article"),
  ).toHaveCount(4);
  await expect(page.locator(".news-game").first()).toBeVisible();
  for (const [id, path, heading] of [
    ["deals", "/deals", "Deals"],
    ["library", "/library", "Library"],
    ["wishlist", "/wishlist", "Wishlist"],
    ["updates", "/updates", "Updates"],
    ["home", "/", "Dashboard"],
  ]) {
    await page.getByTestId(`nav-${id}`).click();
    await expect(page).toHaveURL(path ?? "/");
    await expect(
      page.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("PC Companion: Web URI Mode")).toHaveCount(0);
  }
});

test("clearing sample games keeps games the guest added", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add game" }).first().click();
  await page.getByRole("dialog").getByLabel("Search games").fill("Dota");
  await page
    .getByRole("button", {
      name: "I own it: add Dota 2 to library",
      exact: true,
    })
    .click();
  await expect(page.getByText("✓ In library")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Clear sample games", exact: true })
    .click();
  await expect(
    page.getByText("Your games are saved in this browser"),
  ).toBeVisible();
  await page.getByTestId("nav-library").click();
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Dota 2", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("nav-wishlist")).toContainText("0");
});

test("deals stack filters, show stores, sort offers, and save a wishlist", async ({
  page,
}) => {
  await page.goto("/deals");
  // Owned games are hidden by default; the sample library owns Cyberpunk 2077.
  await expect(page.getByTestId("deal-card")).toHaveCount(11);
  await expect(
    page
      .getByTestId("deal-card")
      .filter({ hasText: "Featured Game 11" })
      .locator(".deal-untracked"),
  ).toHaveText("No Steam match from the price feed. Find it on Steam");
  await page.getByRole("button", { name: "Under $15", exact: true }).click();
  await expect(page.getByTestId("deal-card")).toHaveCount(1);
  await page.getByRole("button", { name: "50%+ off", exact: true }).click();
  await expect(page.getByTestId("deal-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Under $15", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "50%+ off", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Activates on Steam", exact: true })
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
  await expect(page.getByTestId("deal-card")).toHaveCount(11);
  await page.locator(".store-picker summary").click();
  await page.getByLabel("GOG store", { exact: true }).check();
  await expect(page.getByTestId("deal-card")).toHaveCount(3);
  await page.getByLabel("Steam store", { exact: true }).check();
  await expect(page.getByTestId("deal-card")).toHaveCount(7);
  await page.getByLabel("Steam store", { exact: true }).uncheck();
  await expect(page.getByTestId("deal-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "All deals", exact: true }).click();
  await page.getByTestId("deal-search-input").fill("Featured Game 1");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const card = page.getByTestId("deal-card").first();
  await card.getByRole("button", { name: "+ Wishlist", exact: true }).click();
  await expect(card.getByText("On your wishlist")).toBeVisible();
  // Wishlisting never invents a target; the card asks for one instead.
  await expect(
    card.getByLabel("Target price for Featured Game 1", { exact: true }),
  ).toHaveValue("");
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
  await expect(page.getByText("Showing sample games.")).toBeVisible();
  await expect(page.getByTestId("library-card")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Launch Cyberpunk 2077 in Steam" }),
  ).toHaveAttribute("href", "steam://rungameid/1091500");
  // Card launch buttons are secondary (outlined), not the filled accent.
  await expect(
    page.getByRole("link", { name: "Launch Cyberpunk 2077 in Steam" }),
  ).toHaveClass(/(^|\s)secondary(\s|$)/);
  await page
    .getByRole("group", { name: "Filter by status" })
    .getByRole("button", { name: /Completed/ })
    .click();
  await expect(page).toHaveURL(/status=completed/);
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
    purchaseStore: "steam",
  });
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect(page.locator(".backup-panel").getByRole("status")).toHaveText(
    "Backup restored.",
  );
  await page
    .getByRole("group", { name: "Filter by status" })
    .getByRole("button", { name: /All/ })
    .click();
  await expect(page.getByTestId("library-card")).toHaveCount(4);
  await page.reload();
  await expect(page.getByTestId("library-card")).toHaveCount(4);
  await expect(
    page
      .getByTestId("library-card")
      .filter({ hasText: "Counter-Strike 2" })
      .getByText("Paid $0.00 at Steam"),
  ).toBeVisible();
  // Table view is remembered and sortable.
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.locator(".ledger-table")).toBeVisible();
  await expect(page.locator(".card-grid")).toBeHidden();
  await page.getByRole("button", { name: /^Paid/ }).click();
  await expect(
    page.locator(".ledger-table tbody tr").first().getByRole("rowheader"),
  ).toContainText("Baldur's Gate 3");
  await page.reload();
  await expect(page.locator(".ledger-table")).toBeVisible();
});

test("updates merge your games, filter by game, and keep tabs keyboard friendly", async ({
  page,
}) => {
  await page.goto("/updates");
  const feed = page.getByRole("tabpanel");
  // All my games: official posts from every collection game, each labelled.
  await expect(
    feed.getByRole("heading", { name: "Cyberpunk 2077 Patch 1", exact: true }),
  ).toBeVisible();
  await expect(
    feed.getByRole("heading", { name: "Elden Ring Patch 1", exact: true }),
  ).toBeVisible();
  await expect(feed.locator(".news-game").first()).toBeVisible();
  await page.getByTestId("tab-events").click();
  await expect(page.getByTestId("tab-events")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    feed.getByRole("heading", { name: "Night City Festival" }).first(),
  ).toBeVisible();
  await page.getByTestId("tab-events").press("ArrowLeft");
  await expect(page.getByTestId("tab-patches")).toBeFocused();
  await page.getByRole("button", { name: "Elden Ring", exact: true }).click();
  await expect(page).toHaveURL(/game=1245620/);
  await expect(
    page.getByRole("heading", { name: "Elden Ring Patch 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cyberpunk 2077 Patch 1", exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("tab-events").click();
  await expect(
    page.getByRole("heading", { name: "A letter from the developers" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Include community and press posts", { exact: true })
    .check();
  await expect(
    page.getByRole("heading", { name: "A letter from the developers" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Elden Ring", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
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
    page.getByRole("heading", { name: "Prices across stores" }),
  ).toBeVisible();
  await expect(page.getByText("$5.00 less than Steam")).toBeVisible();
  // Owned games show the Steam baseline and the cheapest stores only.
  await expect(page.getByText("baseline")).toBeVisible();
  await page.getByTestId("tab-events").click();
  await expect(
    page.getByRole("heading", { name: "Night City Festival" }),
  ).toBeVisible();
  await page
    .getByLabel("Backlog completion status", { exact: true })
    .selectOption("completed");
  await expect(page.locator(".save-feedback")).toHaveText("Saved.");
  // Key sellers activate on Steam, so launching stays available.
  await page.getByLabel("Bought from").selectOption("gamebillet");
  await expect(page.getByTestId("launch-game-btn")).toBeVisible();
  // Games that run in another launcher can't be launched through Steam.
  await page.getByLabel("Bought from").selectOption("gog");
  await expect(page.getByTestId("launch-game-btn")).toHaveCount(0);
  await expect(
    page.getByText("Plays on GOG Galaxy. Launch it from there."),
  ).toBeVisible();
  await page.getByTestId("nav-library").click();
  await page
    .getByRole("group", { name: "Filter by status" })
    .getByRole("button", { name: /Completed/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cyberpunk 2077", exact: true }),
  ).toBeVisible();
  // Editing a sample made it the user's own and dropped its invented price.
  await expect(
    page.getByText("Price not recorded at GOG · GOG Galaxy (assumed)"),
  ).toBeVisible();
});

test("games you don't own offer buying instead of launching", async ({
  page,
}) => {
  await page.goto("/game/553850");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Helldivers 2",
  );
  await expect(page.getByTestId("launch-game-btn")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Buy for $19.99 at Steam" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "← Wishlist" })).toBeVisible();
});

test("wishlist targets persist in guest mode and drive alerts", async ({
  page,
}) => {
  await page.goto("/wishlist");
  const watch = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Helldivers 2", exact: true }),
  });
  await expect(watch.locator('[data-alert-state="TARGET_MET"]')).toBeVisible();
  await expect(watch.getByText("$5.01 under your $25.00 target")).toBeVisible();
  await expect(watch.getByText("$5.00 less than Steam")).toBeVisible();
  await expect(
    watch.getByRole("link", { name: "Buy at Steam" }),
  ).toHaveAttribute("href", /dealID=steam-deal/);
  await expect(page.getByText("1 game worth buying now.")).toBeVisible();
  // The nav shows the alert count, not the list size, while alerts exist.
  await expect(page.getByTestId("nav-wishlist")).toContainText("1 price alert");
  await expect(watch.locator('[data-field="target"]')).toContainText("$25.00");
  await page
    .getByRole("button", { name: "Edit target price for Helldivers 2" })
    .click();
  await page
    .getByLabel("Target price for Helldivers 2", { exact: true })
    .fill("5");
  await page
    .getByLabel("Target price for Helldivers 2", { exact: true })
    .press("Tab");
  await expect(watch.locator('[data-alert-state="WAIT"]')).toBeVisible();
  await expect(
    page.getByText("Nothing has hit your targets yet."),
  ).toBeVisible();
  await expect(page.getByTestId("nav-wishlist")).toContainText(
    "2 wishlisted games",
  );
  await page.reload();
  await expect(watch.locator('[data-field="target"]')).toContainText("$5.00");
  await expect(page.getByRole("switch")).toHaveCount(0);
});

const signedInSession = {
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
};

test("signed in library uses account data and exports the server backup", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: signedInSession }),
  );
  await page.goto("/library");
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await expect(page.getByText("Showing sample games.")).toHaveCount(0);
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
  // Hiding owned games is the default, so Cyberpunk is filtered out.
  await expect(page.getByTestId("deal-card")).toHaveCount(11);
  const owned = page.getByTestId("deal-card").first();
  await owned.getByRole("button", { name: "I own this", exact: true }).click();
  // The card stays put so purchase details can be added; nothing is assumed.
  await expect(page.getByTestId("deal-card")).toHaveCount(11);
  await expect(owned.getByText("Added to your library.")).toBeVisible();
  await expect(
    owned.getByLabel("Amount paid for Featured Game 1", { exact: true }),
  ).toHaveValue("");
  await owned
    .getByRole("button", { name: /I paid \$9\.99 at Steam: use this/ })
    .click();
  await expect(
    owned.getByLabel("Amount paid for Featured Game 1", { exact: true }),
  ).toHaveValue("9.99");
  await page.getByTestId("nav-library").click();
  await expect(page.getByTestId("library-card")).toHaveCount(2);
  await page
    .getByTestId("library-card")
    .filter({ hasText: "Cyberpunk 2077" })
    .getByRole("link", { name: "View game", exact: true })
    .click();
  await page.getByLabel("Amount paid", { exact: true }).fill("12.34");
  await page.getByLabel("Amount paid", { exact: true }).press("Tab");
  await expect(page.locator(".save-feedback")).toHaveText("Saved.");
  await page
    .getByLabel("Backlog completion status", { exact: true })
    .selectOption("completed");
  await expect(
    page.getByLabel("Backlog completion status", { exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "On Wishlist", exact: true }).click();
  await expect(page.getByTestId("nav-library")).toContainText("1");
  await page.getByLabel("Target price", { exact: true }).fill("7.50");
  await page.getByLabel("Target price", { exact: true }).press("Tab");
  await expect(
    page.getByRole("button", { name: "In Library", exact: true }),
  ).toBeEnabled();
  await page.getByTestId("nav-wishlist").click();
  await expect(page.locator('.watch-card [data-field="target"]')).toContainText(
    "$7.50",
  );
  await page
    .getByRole("button", { name: "Edit target price for Cyberpunk 2077" })
    .click();
  await page
    .getByLabel("Target price for Cyberpunk 2077", { exact: true })
    .fill("");
  await page
    .getByLabel("Target price for Cyberpunk 2077", { exact: true })
    .press("Tab");
  await expect(page.locator(".watch-card .save-feedback")).toHaveText(
    "Target saved.",
  );
  await page.reload();
  await expect(page.locator('.watch-card [data-field="target"]')).toContainText(
    "None",
  );
  await expect(
    page.getByRole("button", { name: "Edit target price for Cyberpunk 2077" }),
  ).toHaveText("Set target");
  await page.getByRole("link", { name: "View game", exact: true }).click();
  await page.getByRole("button", { name: "In Library", exact: true }).click();
  await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
    "12.34",
  );
  await expect(
    page.getByLabel("Backlog completion status", { exact: true }),
  ).toHaveValue("completed");
});

test("signing in offers to move guest games without overwriting account games", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add game" }).first().click();
  await page.getByRole("dialog").getByLabel("Search games").fill("Dota");
  await page
    .getByRole("button", {
      name: "I own it: add Dota 2 to library",
      exact: true,
    })
    .click();
  await expect(page.getByText("✓ In library")).toBeVisible();
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: signedInSession }),
  );
  await page.goto("/library");
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await expect(
    page.getByText("You have 1 game saved in this browser."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add to account", exact: true })
    .click();
  await expect(page.getByText("Added 1 game to your account.")).toBeVisible();
  await expect(page.getByTestId("library-card")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Dota 2", exact: true }),
  ).toBeVisible();
});

test("Game Hub ownership, completion and prices persist across pages with live nav counts", async ({
  page,
}) => {
  await page.goto("/game/1091500");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cyberpunk 2077",
  );
  await expect(
    page.getByRole("link", { name: "Steam store page", exact: true }),
  ).toHaveAttribute("href", "https://store.steampowered.com/app/1091500/");
  await expect(
    page.getByText("Lowest ever $14.99", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "← Library" })).toBeVisible();
  await expect(page.getByTestId("nav-library")).toContainText("3");
  await page.getByLabel("Amount paid", { exact: true }).fill("12.34");
  await page.getByLabel("Amount paid", { exact: true }).press("Tab");
  await expect(page.locator(".save-feedback")).toHaveText("Saved.");
  await page
    .getByLabel("Backlog completion status", { exact: true })
    .selectOption("completed");
  await page.getByTestId("nav-library").click();
  const card = page.getByTestId("library-card").filter({
    has: page.getByRole("heading", { name: "Cyberpunk 2077", exact: true }),
  });
  await expect(card.getByText("Paid $12.34")).toBeVisible();
  await expect(
    card
      .getByRole("group", { name: "Status for Cyberpunk 2077" })
      .getByRole("button", { name: "Completed" }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("link", { name: "View game", exact: true }).click();
  await page.getByRole("button", { name: "On Wishlist", exact: true }).click();
  await expect(page.getByTestId("nav-library")).toContainText("2");
  await page.getByLabel("Target price", { exact: true }).fill("7.50");
  await page.getByLabel("Target price", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Backlog completion status", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "On Wishlist", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("nav-wishlist").click();
  const watch = page.getByRole("article").filter({ hasText: "Cyberpunk 2077" });
  await expect(watch.locator('[data-field="target"]')).toContainText("$7.50");
  await page.reload();
  await expect(watch.locator('[data-field="target"]')).toContainText("$7.50");
  await page.getByTestId("nav-home").click();
  await expect(
    page.locator(".metric-card").filter({ hasText: "Total spent" }),
  ).toContainText("$99.98");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Playing now" }),
  ).toContainText("0");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Unplayed" }),
  ).toContainText("1");
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
  await page
    .getByRole("button", { name: "Edit purchase details for Elden Ring" })
    .click();
  await expect(
    page.getByLabel("Amount paid for Elden Ring", { exact: true }),
  ).toHaveValue("39.99");
  await page.getByTestId("nav-wishlist").click();
  await page.getByLabel("Find in your wishlist", { exact: true }).fill("Hades");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "I own this", exact: true }).click();
  await page.getByTestId("nav-library").click();
  await page.getByLabel("Find in your library", { exact: true }).fill("Hades");
  await expect(
    page.getByText("Price not recorded · Steam (assumed)", { exact: true }),
  ).toBeVisible();
  await page.getByTestId("nav-home").click();
  await expect(
    page.locator(".metric-card").filter({ hasText: "Total spent" }),
  ).toContainText("$129.97");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Total spent" }),
  ).toContainText("3 of 4 purchases recorded");
});

test("deal filters survive refresh and more batches load on demand", async ({
  page,
}) => {
  await page.goto("/deals");
  await expect(page.getByTestId("deal-card")).toHaveCount(11);
  await page.locator(".more-filters summary").click();
  await page.getByLabel("Hide games I already own", { exact: true }).uncheck();
  await expect(page.getByTestId("deal-card")).toHaveCount(12);
  await expect(page).toHaveURL(/owned=show/);
  await page.reload();
  await expect(
    page.getByLabel("Hide games I already own", { exact: true }),
  ).not.toBeChecked();
  await expect(page.getByTestId("deal-card")).toHaveCount(12);
  await page.getByLabel("Offers per page", { exact: true }).selectOption("12");
  await expect(page.getByText("12 games from 12 offers")).toBeVisible();
  await page
    .getByRole("button", { name: "Load more deals", exact: true })
    .click();
  // The fixture has no second batch, so nothing more is offered.
  await expect(
    page.getByRole("button", { name: "Load more deals", exact: true }),
  ).toHaveCount(0);
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
        // Edits must not refetch game details or news. (Moving a game to the
        // wishlist legitimately starts a price check for it.)
        /\/api\/trpc\/.*backlog\.(getGameDetails|getSteamFeed)/.test(
          request.url(),
        )
      )
        publicRequests.push(request.url());
    });
    await page.goto("/game/1091500");
    await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
      "29.99",
    );
    await expect(
      page.getByText("Lowest ever $14.99", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Amount paid", { exact: true })).toBeEnabled();
    const initialRequests = publicRequests.length;
    await page.getByLabel("Amount paid", { exact: true }).fill("18.25");
    // Clicking directly blurs the field and changes membership in the same gesture.
    await page
      .getByRole("button", { name: "On Wishlist", exact: true })
      .click();
    await expect(
      page.getByLabel("Target price", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Backlog completion status", { exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Target price", { exact: true }).fill("7.50");
    await page.getByRole("button", { name: "In Library", exact: true }).click();
    await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
      "18.25",
    );
    await expect(page.locator(".save-state")).toContainText("Saved");
    expect(publicRequests).toHaveLength(initialRequests);
    await page.getByLabel("Amount paid", { exact: true }).fill("19.25");
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
    await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
      "19.25",
    );
    await page.reload();
    await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
      "19.25",
    );
    await page
      .getByRole("button", { name: "On Wishlist", exact: true })
      .click();
    await expect(page.getByLabel("Target price", { exact: true })).toHaveValue(
      "7.5",
    );
  });
}

test.describe("phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("deal rows keep tracking behind Track and show where the price buys", async ({
    page,
  }) => {
    await page.goto("/deals");
    const card = page.getByTestId("deal-card").first();
    await expect(card.locator(".price-link-cue")).toHaveText(/at Steam ↗/);
    await expect(
      card.getByRole("button", { name: "+ Wishlist", exact: true }),
    ).toBeHidden();
    await card.getByRole("button", { name: /Track/ }).click();
    await expect(
      card.getByRole("button", { name: "+ Wishlist", exact: true }),
    ).toBeVisible();
  });
});

test("desktop deal cards show tracking actions without a Track toggle", async ({
  page,
}) => {
  await page.goto("/deals");
  const card = page.getByTestId("deal-card").first();
  await expect(card.getByRole("button", { name: /Track/ })).toBeHidden();
  await expect(
    card.getByRole("button", { name: "+ Wishlist", exact: true }),
  ).toBeVisible();
});

test("saved offers during a store outage are labelled and never promise savings", async ({
  page,
}) => {
  await page.goto("/deals?q=saved");
  await expect(
    page.getByText(
      "Live store prices couldn’t be reached, so these are offers saved on 2026-10-29.",
      { exact: false },
    ),
  ).toBeVisible();
  const card = page.getByTestId("deal-card").first();
  await expect(card.locator(".saved-price")).toHaveText("Saved price");
  await expect(
    card.getByRole("link", { name: /^Saved price \$9\.99 at Steam/ }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: /Check price at/ }),
  ).toBeVisible();
  await expect(card.locator(".steam-line")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Load more deals" }),
  ).toHaveCount(0);
});

test("wishlist moves stay coherent while saves are slow or fail", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: signedInSession }),
  );
  await page.goto("/game/1091500");
  await page.getByRole("button", { name: "On Wishlist", exact: true }).click();
  await expect(page.getByTestId("nav-wishlist")).toContainText("1");
  await page.getByTestId("nav-wishlist").click();
  // Hold the next save open until the test releases it.
  let release = () => undefined as void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/trpc/**upsertBacklogItem**", async (route) => {
    await held;
    await route.fallback();
  });
  await page.getByRole("button", { name: "I own this", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Moved to library" });
  await expect(panel).toContainText("Moving Cyberpunk 2077 to your library…");
  await expect(panel.getByRole("button", { name: "Done" })).toBeDisabled();
  release();
  await expect(panel).toContainText("Cyberpunk 2077 moved to your library.");
  await expect(panel.getByRole("button", { name: "Done" })).toBeEnabled();
  await page.unroute("**/api/trpc/**upsertBacklogItem**");
  // Two overlapping purchase-detail saves: nothing settles until both finish.
  const gates: (() => void)[] = [];
  await page.route("**/api/trpc/**upsertBacklogItem**", async (route) => {
    await new Promise<void>((resolve) => gates.push(resolve));
    await route.fallback();
  });
  await panel
    .getByLabel("Store Cyberpunk 2077 was bought from", { exact: true })
    .selectOption("gog");
  await panel
    .getByLabel("Launcher Cyberpunk 2077 plays on", { exact: true })
    .selectOption("steam");
  // Writes are serialized, so the second request starts after the first.
  await expect.poll(() => gates.length).toBe(1);
  await expect(panel.getByText("Saving…")).toBeVisible();
  gates[0]?.();
  await expect.poll(() => gates.length).toBe(2);
  // The first finished, but the second is still outstanding.
  await expect(panel.getByText("Saving…")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Done" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Undo" })).toBeDisabled();
  gates[1]?.();
  await expect(panel.getByText("Saved.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Done" })).toBeEnabled();
  await page.unroute("**/api/trpc/**upsertBacklogItem**");
  // A failed purchase-detail save stays visible.
  await page.route("**/api/trpc/**upsertBacklogItem**", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );
  await panel
    .getByLabel("Amount paid for Cyberpunk 2077", { exact: true })
    .fill("5");
  await panel
    .getByLabel("Amount paid for Cyberpunk 2077", { exact: true })
    .press("Tab");
  await expect(
    panel.getByText("Couldn’t save the amount paid. Try changing it again."),
  ).toBeVisible();
  await page.unroute("**/api/trpc/**upsertBacklogItem**");
  // A failed store write followed by a successful launcher write must not
  // announce "Saved."; retrying the store clears its error.
  let calls = 0;
  await page.route("**/api/trpc/**upsertBacklogItem**", async (route) => {
    calls += 1;
    if (calls === 1) await route.fulfill({ status: 500, body: "{}" });
    else await route.fallback();
  });
  await panel
    .getByLabel("Store Cyberpunk 2077 was bought from", { exact: true })
    .selectOption("humble");
  await panel
    .getByLabel("Launcher Cyberpunk 2077 plays on", { exact: true })
    .selectOption("gog");
  await expect.poll(() => calls).toBe(2);
  await expect(
    panel.getByText(
      "Couldn’t save the amount paid and store. Try changing them again.",
    ),
  ).toBeVisible();
  await expect(panel.getByText("Saved.")).toHaveCount(0);
  await panel
    .getByLabel("Store Cyberpunk 2077 was bought from", { exact: true })
    .selectOption("fanatical");
  await expect(
    panel.getByText("Couldn’t save the amount paid. Try changing it again."),
  ).toBeVisible();
  await panel
    .getByLabel("Amount paid for Cyberpunk 2077", { exact: true })
    .fill("6");
  await panel
    .getByLabel("Amount paid for Cyberpunk 2077", { exact: true })
    .press("Tab");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByText("Saved.")).toBeVisible();
  await page.unroute("**/api/trpc/**upsertBacklogItem**");
  // Undo returns the card and puts focus back on its button.
  await panel.getByRole("button", { name: "Undo" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('[data-own-button="1091500"]')).toBeFocused();
  // Moving the last wishlist game and closing the panel keeps focus on the
  // results region, which stays mounted for the empty state.
  await page.getByRole("button", { name: "I own this", exact: true }).click();
  await expect(panel).toContainText("Cyberpunk 2077 moved to your library.");
  await panel.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Your wishlist is empty.")).toBeVisible();
  await expect(page.locator("main [tabindex='-1']").first()).toBeFocused();
  // The forced 500 above is expected; clear it from the error log.
  browserErrors.get(page)?.splice(0);
});

test("patch notes reader shows the overview, opens changes and adds an AI summary", async ({
  page,
}) => {
  await page.goto("/patch/553850/1847920302234123");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("7.2.2");
  const glance = page.getByRole("region", { name: "Patch at a glance" });
  await expect(glance.locator(".patch-legend")).toContainText("1 nerf");
  await expect(glance.locator(".patch-legend")).toContainText("2 buffs");
  await expect(glance.getByRole("heading", { name: /Buffs/ })).toBeVisible();
  await expect(
    page.getByText(/2 buffs, 1 nerf, and 1 fix across/),
  ).toBeVisible();
  // A tile jumps to that change in the full notes.
  await glance.getByRole("button", { name: "AMW-20 APEX" }).click();
  await expect(
    page.getByRole("tab", { name: "Full patch notes" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#change-0-0")).toBeFocused();
  await expect(page.locator("#change-0-0")).toContainText(
    "Decreased caliber from 60 to 20",
  );
  // Premium preview: the AI summary is requested on demand.
  await page.getByRole("tab", { name: "Quick read" }).click();
  await page.getByRole("button", { name: "Summarize this patch" }).click();
  await expect(
    page.getByText(
      "A small balance patch that makes two Stratagems hit harder.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Sorted by AI summary")).toBeVisible();
});
