import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import SuperJSON from "superjson";
import { z } from "zod/v4";

import {
  BacklogExportSchema,
  cleanSteamText,
  CollectionFeedInputSchema,
  digestNews,
  GameSearchInputSchema,
  parsePatchNotes,
  PatchNotesInputSchema,
  riotGame,
  SearchDealsInputSchema,
  searchRiotGames,
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
  1422450: "Deadlock",
};
function steamFeed(steamAppId: number) {
  // Riot's games get Riot-sourced posts that open on Riot's site.
  const riot = riotGame(steamAppId);
  const item = {
    steamAppId,
    cleanSummary: "Performance improvements and bug fixes.",
    digest: digestNews("Performance improvements and bug fixes.", ""),
    patchCounts: null,
    url: riot
      ? `${riot.site}/en-us/news/game-updates/patch-notes`
      : `https://store.steampowered.com/news/app/${steamAppId}`,
    publishedAt: new Date("2026-10-22T12:00:00Z"),
    official: true,
    source: riot ? ("riot" as const) : ("steam" as const),
  };
  return {
    available: true,
    patchNotes: [0, 1, 2].map((index) => ({
      ...item,
      id: `patch-${index}`,
      category: "patch_note" as const,
      title: `${titles[steamAppId] ?? riot?.title ?? steamAppId} Patch ${index + 1}`,
    })),
    events: [
      {
        ...item,
        id: "festival",
        category: "event" as const,
        title: "Night City Festival",
        cleanSummary: "Join the limited-time celebration.",
        digest: digestNews(
          "Join the limited-time celebration.",
          "Night City Festival",
        ),
      },
      {
        ...item,
        id: "letter",
        official: false,
        category: "general" as const,
        title: "A letter from the developers",
        cleanSummary: "Thank you for playing.",
        digest: digestNews(
          "Thank you for playing.",
          "A letter from the developers",
        ),
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

async function mockDealResults(
  page: Page,
  offers: ((typeof deals)[number] & {
    source?: "cheapshark" | "steam" | "catalog";
  })[],
  steamPrices: Record<number, number>,
  live = true,
) {
  const t = initTRPC.create({ transformer: SuperJSON });
  const router = t.router({
    backlog: t.router({
      searchDeals: t.procedure.input(SearchDealsInputSchema).query(() => ({
        offers,
        live,
        snapshotAt: live ? null : "2026-10-29",
      })),
      getSteamPrices: t.procedure.input(z.unknown()).query(() => steamPrices),
      getGamePrices: t.procedure
        .input(z.object({ steamAppId: z.number() }))
        .query(({ input }) => ({ prices: fixturePrices(input.steamAppId) })),
      getCollectionFeed: t.procedure
        .input(z.unknown())
        .query(() => ({ items: [], unavailable: [] })),
    }),
  });
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      router,
      createContext: () => ({}),
      req: new Request(request.url(), {
        headers: await request.allHeaders(),
      }),
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
}
const patchPost = `[h3]Stratagems[/h3][p][i]AMW-20 APEX[/i][/p][p]Problem we want to solve:[/p][list][*]Demolition strength was too low[/*][/list][p]Changes:[/p][list][*]Decreased caliber from 60 to 20[/*][*]Increased demolition strength to 30[/*][/list][p][i]SG-22 BUSHWACKER[/i][/p][list][*]Increased damage from 405 to 486[/*][/list][h3]Fixes[/h3][list][*]Fixed a crash when joining a squad[/*][/list]`;
const deadlockPatchPost = [
  "[h3]Heroes[/h3][list]",
  "[*]Scorn - Heal from heroes increased from 1.2x to 1.3x[/*]",
  "[*]Sand Blast - T2 slow from -24% Slow and -26% Dash distance to -28% for both[/*]",
  "[*]Radiant Daggers - Range reduced from 30m to 25m (moved to T2)[/*]",
  "[*]Lurking Terrors - Fear buildup time reduced from 2s to 1.75s[/*]",
  "[/list]",
].join("");
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
  // Fixture games use made-up Steam IDs whose art doesn't exist. Optimized
  // images are same-origin, so their 404s would count as console errors;
  // these tests don't check artwork, so serve a 1×1 placeholder instead.
  await page.route("**/_next/image**", (route) =>
    route.fulfill({
      contentType: "image/gif",
      body: Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64",
      ),
    }),
  );
  // Unoptimized images and plain <img> elements use the art resolver directly.
  await page.route("**/api/art/**", (route) =>
    route.fulfill({
      contentType: "image/gif",
      body: Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64",
      ),
    }),
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
          results: [
            ...searchRiotGames(input.query).map((game) => ({
              steamAppId: game.id,
              title: game.title,
              image: "",
              price: 0,
              developer: "Riot Games",
              source: "riot" as const,
            })),
            ...Object.entries(titles)
              .filter(([, title]) =>
                title.toLowerCase().includes(input.query.toLowerCase()),
              )
              .map(([id, title]) => ({
                steamAppId: Number(id),
                title,
                image: "",
                price: 19.99,
              })),
          ],
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
          const patch = parsePatchNotes(
            input.steamAppId === 1422450 ? deadlockPatchPost : patchPost,
            "Devoid of Liberty: 7.2.2",
          );
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
            name:
              titles[input.steamAppId] ??
              riotGame(input.steamAppId)?.title ??
              `Steam App ${input.steamAppId}`,
            short_description: "A world waiting to be explored.",
          },
          // Riot's games aren't sold in PC stores.
          prices: riotGame(input.steamAppId)
            ? null
            : fixturePrices(input.steamAppId),
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
  await expect(page).toHaveTitle("Gemuzu");
  await expect(
    page.getByText("You’re exploring with sample games"),
  ).toBeVisible();
  for (const metric of ["Price alerts", "Total spent", "Paid, never played"])
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
    ["home", "/", "Home"],
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
  const featured = page.locator(".deal-featured");
  await expect(featured.getByRole("heading")).toHaveText("Featured Game 2");
  await expect(featured.locator(".deal-featured-eyebrow")).toHaveText(
    "Biggest saving vs Steam",
  );
  await expect(featured.locator(".deal-price")).toHaveText("$31.99");
  // The billboard uses the wide hero art (header as its fallback).
  await expect(featured.locator(".game-art")).toHaveAttribute(
    "src",
    new RegExp(`/api/art/${deals[2]?.steamAppId}/(hero|header)$`),
  );
  await expect(featured.locator(".steam-line")).toHaveText(
    "Steam $39.99 · save $8.00 (−20%)",
  );
  await expect(page.locator(".deal-grid .deal-featured")).toHaveCount(0);
  await expect(page.locator(".deal-divider")).toHaveText(
    "Other editions: no live Steam price to compare",
  );
  const unmatched = page
    .getByTestId("deal-card")
    .filter({ hasText: "Featured Game 11" });
  await expect(unmatched).toHaveClass("deal-row");
  await expect(unmatched.locator(".steam-line")).toHaveCount(0);
  await expect(
    unmatched.getByRole("button", { name: "Find on Steam", exact: true }),
  ).toBeVisible();
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

for (const width of [1024, 1440]) {
  test(`deals align edition prices and actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const offers = deals.slice(0, 7).map((deal, index) => ({
      ...deal,
      title: `Comparison fixture ${index}`,
      steamAppId: index < 4 ? 2000 + index : null,
      storeId: index === 0 ? "1" : index % 2 === 0 ? "25" : "3",
      cheapestPrice: [28.78, 27.99, 25.91, 9.99, 0, 6.99, 7.99][index] ?? 9.99,
      source: "cheapshark" as const,
    }));
    await mockDealResults(page, offers, { 2000: 28.78, 2001: 30, 2002: 60 });
    await page.goto("/deals");
    await expect(page.locator(".page-stat")).toHaveText(
      "2 of 3 with a Steam price beat it",
    );
    await expect(page.locator(".deal-grid-pair > .deal-card")).toHaveCount(2);
    for (const card of await page
      .locator(".deal-grid-pair > .deal-card")
      .all()) {
      const art = await card.locator(".deal-art").boundingBox();
      expect(art?.width).toBe(240);
      expect(art?.height).toBe(112);
      expect(
        await card.evaluate((element) => element.scrollWidth),
      ).toBeLessThanOrEqual(
        await card.evaluate((element) => element.clientWidth),
      );
    }
    const steamCard = page.getByTestId("deal-card").filter({
      has: page.getByRole("heading", { name: "Comparison fixture 0" }),
    });
    await expect(steamCard.locator(".deal-ledger > .price-link")).toHaveText(
      /Best · Steam\s*\$28.78/,
    );
    await expect(steamCard.locator(".steam-line")).toHaveCount(0);
    await expect(steamCard.locator(".deal-best-note")).toHaveText(
      "Steam has the best price",
    );
    const rows = page.locator(".deal-row");
    await expect(rows).toHaveCount(4);
    const bounds = await rows.evaluateAll((elements) =>
      elements.map((element) => ({
        height: element.getBoundingClientRect().height,
        priceRight: element
          .querySelector(".deal-row-price")
          ?.getBoundingClientRect().right,
        actionsLeft: element
          .querySelector(".deal-actions")
          ?.getBoundingClientRect().left,
      })),
    );
    for (const boundsOfRow of bounds) {
      expect(boundsOfRow.height).toBeLessThanOrEqual(84);
      expect(boundsOfRow.priceRight).toBe(bounds[0]?.priceRight);
      expect(boundsOfRow.actionsLeft).toBe(bounds[0]?.actionsLeft);
    }
    for (const row of await rows.all()) {
      await expect(row.locator(".deal-actions").getByRole("link")).toHaveCount(
        1,
      );
      await expect(
        row.locator(".deal-actions").getByRole("button"),
      ).toHaveCount(1);
    }
    await expect(
      rows.first().getByRole("button", { name: "Track ▾" }),
    ).toBeVisible();
    await expect(rows.nth(1).locator(".ledger-label")).toHaveCount(0);
    await expect(rows.nth(1).locator(".deal-price")).toHaveText("Free");
    await page.getByRole("button", { name: "Under $15", exact: true }).click();
    await expect(page.locator(".page-stat")).toHaveText(
      "No Steam prices to compare in these results",
    );
    await expect(page.getByTestId("deal-card")).toHaveCount(4);
    await expect(page).toHaveURL(/price=14\.99/);
  });
}

for (const width of [768, 840, 1024, 1440]) {
  test(`a singleton matched deal stays compact at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const offers = deals.slice(1, 3).map((deal, index) => ({
      ...deal,
      title: index === 0 ? "SULFUR" : "Featured saving",
      cheapestPrice: index === 0 ? 28.78 : 25.54,
      normalPrice: 49.98,
      storeId: index === 0 ? "1" : "3",
    }));
    await mockDealResults(page, offers, { 1001: 28.78, 1002: 31.49 });
    await page.goto("/deals");
    const card = page.locator(".deal-grid-pair > .deal-card:only-child");
    await expect(card.getByRole("heading")).toHaveText("SULFUR");
    await expect(card.locator(".deal-best-note")).toHaveText(
      "Steam has the best price",
    );
    await expect(
      card.getByRole("button", { name: "+ Wishlist", exact: true }),
    ).toBeHidden();
    const bounds = await card.evaluate((element) => {
      const buy = element.querySelector(".deal-buy")?.getBoundingClientRect();
      const track = element
        .querySelector(".track-toggle-button")
        ?.getBoundingClientRect();
      return {
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width,
        gridWidth: element.parentElement?.getBoundingClientRect().width,
        ledgerWidth: element
          .querySelector(".deal-ledger")
          ?.getBoundingClientRect().width,
        buyCenter: buy ? buy.top + buy.height / 2 : undefined,
        trackCenter: track ? track.top + track.height / 2 : undefined,
        buyRight: buy?.right,
        trackLeft: track?.left,
      };
    });
    // The was-price sits under the price ledger (round 7), adding one line.
    expect(bounds.height).toBeLessThanOrEqual(180);
    expect(bounds.width).toBe(bounds.gridWidth);
    expect(bounds.ledgerWidth).toBeLessThanOrEqual(300);
    expect(bounds.buyCenter).toBe(bounds.trackCenter);
    expect(bounds.buyRight).toBeLessThan(bounds.trackLeft ?? 0);
    await card.getByRole("button", { name: "Track ▾" }).click();
    await expect(
      card.getByRole("button", { name: "+ Wishlist", exact: true }),
    ).toBeVisible();
  });
}

test("a featured deal without real artwork keeps its price and Steam saving", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.route("**/api/art/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"/>',
    }),
  );
  const offers = deals.slice(2, 3).map((deal) => ({ ...deal, thumb: "" }));
  await mockDealResults(page, offers, { 1002: 39.99 });
  await page.goto("/deals");
  const featured = page.locator(".deal-featured");
  await expect(featured).toHaveClass(/\bno-art\b/);
  await expect(featured.locator(".deal-art")).toBeHidden();
  await expect(featured.getByRole("heading")).toHaveText("Featured Game 2");
  await expect(featured.locator(".deal-price")).toHaveText("$31.99");
  await expect(featured.locator(".steam-line")).toHaveText(
    "Steam $39.99 · save $8.00 (−20%)",
  );
  const bounds = await featured.boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(180);
  expect(bounds?.height).toBeLessThanOrEqual(220);
});

for (const scenario of ["epic", "steam", "cached-zero", "unknown"] as const) {
  test(`free deal follow-up preserves ${scenario} availability`, async ({
    page,
  }, testInfo) => {
    const cached = scenario === "cached-zero";
    const storeId =
      scenario === "steam" ? "1" : scenario === "unknown" ? "" : "25";
    const url =
      scenario === "steam"
        ? "https://store.steampowered.com/app/1001"
        : "https://store.epicgames.com/en-US/p/free-fixture";
    const offers = deals.slice(1, 2).map((deal) => ({
      ...deal,
      title: "Free fixture",
      cheapestPrice: 0,
      normalPrice: 3.99,
      savingsPercent: 100,
      storeId,
      url,
      source: cached
        ? ("catalog" as const)
        : scenario === "steam"
          ? ("steam" as const)
          : ("cheapshark" as const),
    }));
    await mockDealResults(page, offers, {}, !cached);
    await page.goto("/deals");
    const card = page.getByTestId("deal-card");
    await expect(card.locator(".deal-price")).toHaveText("Free");
    await card.getByRole("button", { name: "Track ▾" }).click();
    await card.getByRole("button", { name: "+ Wishlist", exact: true }).click();
    const followUp = card.locator(".track-actions");
    await expect(followUp.getByText("On your wishlist")).toBeVisible();
    const availability = followUp.getByRole("link", {
      name:
        cached || scenario === "unknown"
          ? "Check availability"
          : `Get it free at ${scenario === "steam" ? "Steam" : "Epic Games Store"}`,
    });
    await expect(availability).toBeVisible();
    await expect(availability).toHaveAttribute("href", url);
    if (cached || scenario === "unknown") {
      await expect(
        followUp.getByRole("link", { name: /Get it free/ }),
      ).toHaveCount(0);
    } else {
      await expect(
        followUp.getByText("Free right now; nothing to wait for"),
      ).toBeVisible();
    }
    await expect(page.getByLabel(/Target price for/)).toHaveCount(0);
    await expect(page.getByText("$0.00", { exact: false })).toHaveCount(0);
    await testInfo.attach(`free-follow-up-${scenario}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}

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
      .getByText("Got it free at Steam"),
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
  await page.clock.setFixedTime(new Date("2026-10-29T12:00:00Z"));
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
  await expect(feed.locator('[data-category="patch_note"]')).toHaveCount(0);
  await expect(feed.locator(".news-topics").first().locator("li")).toHaveText([
    "Performance",
    "Bug fixes",
  ]);
  await expect(feed.locator(".news-lead").first()).toHaveText(
    "Performance improvements and bug fixes.",
  );
  const gameCount = await page.locator(".updates-filter .pill-count").count();
  await expect(page.locator(".updates-count-help")).toHaveText(
    "Patch notes in the last 30 days",
  );
  await expect(page.locator(".page-stat")).toHaveText(
    `${gameCount * 3} patches in the last 30 days`,
  );
  await expect(
    page.getByTestId("tab-patches").locator(".tab-count"),
  ).toHaveText(String(gameCount * 3));
  await expect(page.locator(".updates-count-period")).toHaveText(
    Array.from({ length: gameCount }, () => "in 30 days"),
  );
  await expect(feed.locator(".news-patch-summary")).toHaveCount(0);
  await page.getByTestId("tab-events").click();
  await expect(page.getByTestId("tab-events")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".updates-count-help")).toHaveText(
    "Events in the last 30 days",
  );
  await expect(page.locator(".page-stat")).toHaveText(
    `${gameCount} events in the last 30 days`,
  );
  await expect(page.getByTestId("tab-events").locator(".tab-count")).toHaveText(
    String(gameCount),
  );
  await expect(
    page.locator('.updates-filter [id^="updates-count-"]'),
  ).toHaveText(
    Array.from({ length: gameCount }, () => "1 event in the last 30 days"),
  );
  await expect(
    feed.getByRole("heading", { name: "Night City Festival" }).first(),
  ).toBeVisible();
  await expect(feed.locator('[data-category="event"]').first()).toHaveText(
    "Event",
  );
  await expect(feed.locator(".news-lead").first()).toHaveText(
    "Join the limited-time celebration.",
  );
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

test("updates count recent categories and link classified patch summaries", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-29T12:00:00Z"));
  const t = initTRPC.create({ transformer: SuperJSON });
  const router = t.router({
    backlog: t.router({
      getCollectionFeed: t.procedure
        .input(CollectionFeedInputSchema)
        .query(({ input }) => ({
          unavailable: [],
          items: input.steamAppIds.flatMap((id) => {
            const feed = steamFeed(id);
            return [
              ...feed.patchNotes.map((item, index) => {
                const contents =
                  index === 0
                    ? `INCOMING TRANSMISSION FROM SUPER EARTH HIGH COMMAND. ${"Our scientists have a problem to solve. ".repeat(12)}${patchPost}`
                    : index === 1
                      ? "[p]This hotfix aims to resolve one of the main crashes we have seen.[/p][h2]🔧 Fixes[/h2][b]Crash Fixes[/b][list][*]Fixed a crash that would occur when another player joined or left the squad.[/*][*]Fixed a menu bug.[/*][*]Fixed matchmaking.[/*][*]Adjusted the settings menu.[/*][/list][p]🧠 Known Issues[/p][list][*]Crashes can still occur on exit.[/*][/list]"
                      : `The operation begins tomorrow ${"with reinforcements ".repeat(12)}. 🧠 Known Issues`;
                const patch = parsePatchNotes(contents, item.title);
                return {
                  ...item,
                  id: `${id}${index}`,
                  cleanSummary: index === 2 ? contents : item.cleanSummary,
                  // Match the server's compact digest and counts serialization.
                  digest: digestNews(
                    cleanSteamText(contents),
                    item.title,
                    patch,
                  ),
                  patchCounts: summarizePatch(patch).counts,
                  publishedAt: new Date(
                    index === 2
                      ? "2026-09-01T12:00:00Z"
                      : "2026-10-22T12:00:00Z",
                  ),
                };
              }),
              ...feed.events.filter((item) => item.official && id !== 1245620),
            ];
          }),
        })),
      // The collection feed is batched with the price checks.
      getGamePrices: t.procedure
        .input(z.object({ steamAppId: z.number() }))
        .query(({ input }) => ({ prices: fixturePrices(input.steamAppId) })),
    }),
  });
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    if (!new URL(request.url()).pathname.includes("backlog.getCollectionFeed"))
      return route.fallback();
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      router,
      createContext: () => ({}),
      req: new Request(request.url(), {
        method: request.method(),
        headers: await request.allHeaders(),
      }),
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
  await page.goto("/updates");
  const feed = page.getByRole("tabpanel");
  const detailed = feed.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Cyberpunk 2077 Patch 1",
      exact: true,
    }),
  });
  await expect(detailed.locator(".news-patch-count")).toHaveText([
    "▼ 1 nerf",
    "▲ 2 buffs",
    // Fixes get their own chip, matching the patch reader's legend.
    "✓ 1 fix",
  ]);
  await expect(detailed.locator(".news-lead")).toHaveText(
    "AMW-20 APEX: Decreased caliber from 60 to 20",
  );
  await expect(
    detailed.locator(".news-digest-meta .news-topics li"),
  ).toHaveText(["Crash fixes", "Bug fixes"]);
  const fixes = feed.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Cyberpunk 2077 Patch 2",
      exact: true,
    }),
  });
  await expect(fixes.locator(".news-patch-count")).toHaveText([
    "↻ 1 change",
    "✓ 3 fixes",
  ]);
  await expect(fixes.locator(".news-lead")).toHaveText(
    "Fixed a crash that would occur when another player joined or left the squad.",
  );
  const fallback = feed.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Cyberpunk 2077 Patch 3",
      exact: true,
    }),
  });
  const fallbackLead = await fallback.locator(".news-lead").innerText();
  expect(fallbackLead.length).toBeLessThanOrEqual(140);
  expect(fallbackLead).toMatch(/^The operation begins tomorrow /);
  expect(fallbackLead).not.toContain("Known Issues");
  await expect(
    feed
      .locator(".news-patch-count")
      .filter({ hasText: /\b0 (nerfs|buffs|changes|fixes)\b/ }),
  ).toHaveCount(0);
  await expect(detailed.locator(".news-patch-summary")).toHaveAttribute(
    "href",
    "/patch/1091500/10915000",
  );
  await expect(
    detailed.getByRole("link", { name: /^Read patch notes\b/ }),
  ).toHaveAttribute("href", "/patch/1091500/10915000");
  const gameCount = await page.locator(".updates-filter .pill-count").count();
  await expect(feed.locator(".news-patch-summary")).toHaveCount(gameCount * 2);
  await expect(page.locator(".page-stat")).toHaveText(
    `${gameCount * 2} patches in the last 30 days`,
  );
  await expect(
    page.getByTestId("tab-patches").locator(".tab-count"),
  ).toHaveText(String(gameCount * 2));
  await expect(
    page.locator('.updates-filter [id^="updates-count-"]'),
  ).toHaveText(
    Array.from(
      { length: gameCount },
      () => "2 patch notes in the last 30 days",
    ),
  );
  // The count excludes older posts without removing their date group.
  await expect(
    feed.getByRole("heading", { name: "Last 6 months" }),
  ).toBeVisible();
  await page.getByTestId("tab-events").click();
  await expect(page.locator(".page-stat")).toHaveText(
    `${gameCount - 1} events in the last 30 days`,
  );
  const emptyGame = page.getByRole("button", {
    name: "Elden Ring",
    exact: true,
  });
  await expect(emptyGame.locator(".pill-count")).toBeEmpty();
  await expect(emptyGame).toHaveAccessibleDescription(
    "0 events in the last 30 days",
  );
  await expect(emptyGame.locator(".pill-count")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect(
    page.locator('.updates-filter .pill-count:not([data-empty="true"])'),
  ).toHaveCount(gameCount - 1);
  await expect(feed.locator(".news-patch-summary")).toHaveCount(0);
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
  // Decorative hero art behind the title; the name stays readable as text.
  await expect(page.locator(".hero-backdrop img")).toHaveAttribute(
    "src",
    // Served through the image optimizer, so the Steam URL is encoded.
    /1091500(\/|%2F)(library_hero\.jpg|header\.jpg|hero|header)/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cyberpunk 2077",
  );
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
    .getByLabel("Completion status", { exact: true })
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
    page.getByText(
      "Price not recorded at GOG · plays on GOG Galaxy (unconfirmed)",
    ),
  ).toBeVisible();
});

for (const width of [1024, 1440]) {
  for (const { appId, title, logoWidth, logoHeight, hasLogo } of [
    {
      appId: 1091500,
      title: "Cyberpunk 2077",
      logoWidth: 360,
      logoHeight: 100,
      hasLogo: true,
    },
    {
      appId: 1422450,
      title: "Deadlock",
      logoWidth: 160,
      logoHeight: 160,
      hasLogo: false,
    },
  ]) {
    test(`${title} hero evaluates preloaded logos at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/logo.png", (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="${logoWidth}" height="${logoHeight}"><rect width="100%" height="100%" fill="white"/></svg>`,
        }),
      );
      // Hold hydration until the SSR image has loaded: no React load event.
      let hydrate: () => void = () => undefined;
      const scriptsReady = new Promise<void>((resolve) => {
        hydrate = resolve;
      });
      await page.route("**/_next/static/**/*.js", async (route) => {
        await scriptsReady;
        await route.continue();
      });
      try {
        await page.goto(`/game/${appId}`, { waitUntil: "commit" });
        await expect
          .poll(() =>
            page
              .locator(".hero-logo")
              .evaluate((image) =>
                image instanceof HTMLImageElement && image.complete
                  ? image.naturalWidth
                  : 0,
              ),
          )
          .toBe(logoWidth);
      } finally {
        hydrate();
      }
      const heading = page.locator(".hero-title");
      await expect(heading).toHaveText(title);
      if (hasLogo) await expect(heading).toHaveClass(/has-logo/);
      else await expect(heading).not.toHaveClass(/has-logo/);

      for (const viewport of [width, 840, 768, 390]) {
        await page.setViewportSize({ width: viewport, height: 900 });
        const back = page.locator(".hero-body .back-link");
        await expect(back).toHaveCSS("position", "static");
        // Measured once layout settles after the resize (fonts, logo).
        await expect
          .poll(async () => {
            const backBottom = await back.evaluate(
              (element) => element.getBoundingClientRect().bottom,
            );
            const titleTop = await heading
              .locator(":scope > span")
              .evaluate((element) => element.getBoundingClientRect().top);
            return titleTop - backBottom;
          })
          .toBeGreaterThanOrEqual(24);
      }
      // Also exercise normal loading after the hydration gate is open.
      await page.reload();
      await expect(heading).toHaveText(title);
      if (hasLogo) await expect(heading).toHaveClass(/has-logo/);
      else await expect(heading).not.toHaveClass(/has-logo/);
    });
  }
}

test.describe("touch detail back links", () => {
  test.use({ hasTouch: true });
  // Three widths × three detail pages, each reached from Updates.
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["dark", "light"]) {
    test(`keep their name, arrow gap and heading clearance in ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript(
        (mode) => localStorage.setItem("theme-mode", mode),
        theme,
      );
      for (const width of [390, 768, 840]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of [
          "/game/1091500",
          "/game/1422450",
          "/patch/1422450/1847920302234123",
        ]) {
          // Arrive from Updates each time so the back link names it; wait
          // until Updates has recorded itself in the in-app history.
          await page.goto("/updates");
          await page.waitForFunction(() =>
            sessionStorage.getItem("gemuzu-nav")?.includes('"/updates"'),
          );
          await page.goto(path);
          const back = page.locator("main .back-link");
          await expect(back).toHaveAccessibleName("Back to Updates");
          await expect(back).toHaveCSS("display", /^(inline-)?flex$/);
          await expect
            .poll(() =>
              back.evaluate(
                (element) => element.getBoundingClientRect().height,
              ),
            )
            .toBeGreaterThanOrEqual(44);
          await expect
            .poll(() =>
              back.evaluate((element) => {
                const [arrow, label] = element.children;
                if (!arrow || !label) return 0;
                return (
                  label.getBoundingClientRect().left -
                  arrow.getBoundingClientRect().right
                );
              }),
            )
            .toBeGreaterThanOrEqual(6);
          await expect
            .poll(async () => {
              const backBottom = await back.evaluate(
                (element) => element.getBoundingClientRect().bottom,
              );
              const titleTop = await page
                .locator(".hero-title > span, .patch-hero .patch-game")
                .evaluate((element) => element.getBoundingClientRect().top);
              return titleTop - backBottom;
            })
            .toBeGreaterThanOrEqual(24);
          await back.click();
          await expect(page).toHaveURL(/\/updates$/);
        }
      }
    });
  }
});

for (const theme of ["dark", "light"]) {
  test(`wrapped game navigation has a solid readable surface in ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript(
      (mode) => localStorage.setItem("theme-mode", mode),
      theme,
    );
    await page.goto("/game/1091500");
    const nav = page.locator(".site-nav");
    for (const width of [640, 768, 840, 1023]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(nav).toHaveCSS("background-color", "rgb(18, 20, 17)");
      const contrasts = await nav.evaluate((element) => {
        const luminance = (color: string) => {
          const [red = 0, green = 0, blue = 0] = (color.match(/[\d.]+/g) ?? [])
            .slice(0, 3)
            .map((channel) => {
              const value = Number(channel) / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            });
          return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        };
        const surface = luminance(getComputedStyle(element).backgroundColor);
        return [
          ...element.querySelectorAll(
            ".brand, .nav-link, .nav-count, .nav-controls .action",
          ),
        ].map((label) => {
          const style = getComputedStyle(label);
          const background = label.matches(
            ".nav-count, .action:not(.secondary)",
          )
            ? luminance(style.backgroundColor)
            : surface;
          const foreground = luminance(style.color);
          return (
            (Math.max(foreground, background) + 0.05) /
            (Math.min(foreground, background) + 0.05)
          );
        });
      });
      for (const contrast of contrasts)
        expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(nav).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });
}

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
  await expect(
    page.getByRole("link", { name: /^(Back to )?Wishlist$/ }),
  ).toBeVisible();
});

test("wishlist targets persist in guest mode and drive alerts", async ({
  page,
}) => {
  await page.goto("/wishlist");
  const watch = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Helldivers 2", exact: true }),
  });
  await expect(watch.locator('[data-alert-state="TARGET_MET"]')).toBeVisible();
  await expect(
    watch.getByText("$5.01 under your target, worth buying"),
  ).toBeVisible();
  await expect(watch.getByText("$5.00 less than Steam")).toBeVisible();
  await expect(watch.locator(".watch-source")).toHaveText(
    "at Steam · 1 store compared",
  );
  await expect(
    watch.getByRole("link", { name: "Buy at Steam" }),
  ).toHaveAttribute("href", /dealID=steam-deal/);
  await expect(watch.locator(".watch-buy")).not.toHaveClass(/secondary/);
  await expect(watch.locator(".price-track")).toBeVisible();
  await expect(page.getByText("1 of 2 at your price")).toBeVisible();
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
  await expect(watch.locator(".watch-buy")).toHaveClass(/secondary/);
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

test("wishlist loading keeps saved targets and card geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release = () => undefined as void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/trpc/**getGamePrices**", async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto("/wishlist", { waitUntil: "domcontentloaded" });
  const watch = page.locator(".watch-card").filter({
    has: page.getByRole("heading", { name: "Helldivers 2", exact: true }),
  });
  let loadingHeight = 0;
  try {
    await expect(watch.locator('[data-field="target"]')).toContainText(
      "$25.00",
    );
    await expect(
      watch.locator('[data-field="target"] .watch-skeleton'),
    ).toHaveCount(0);
    await expect(watch.locator(".watch-skeleton-price")).toBeVisible();
    loadingHeight = await watch.evaluate(
      (card) => card.getBoundingClientRect().height,
    );
  } finally {
    release();
  }
  await expect(watch.locator('[data-alert-state="TARGET_MET"]')).toBeVisible();
  const loadedHeight = await watch.evaluate(
    (card) => card.getBoundingClientRect().height,
  );
  expect(loadedHeight).toBeLessThanOrEqual(440);
  expect(Math.abs(loadedHeight - loadingHeight)).toBeLessThanOrEqual(1);
});

for (const scenario of [
  "unavailable",
  "offline",
  "partial",
  "free",
  "cached-free",
] as const) {
  test(`wishlist handles ${scenario} prices honestly`, async ({ page }) => {
    const t = initTRPC.create({ transformer: SuperJSON });
    const router = t.router({
      backlog: t.router({
        // The navbar's unread-news check is batched with price requests.
        getCollectionFeed: t.procedure
          .input(z.unknown())
          .query(() => ({ items: [], unavailable: [] })),
        getGamePrices: t.procedure
          .input(z.object({ steamAppId: z.number() }))
          .query(({ input }) => ({
            prices:
              scenario === "unavailable" ||
              scenario === "offline" ||
              (scenario === "partial" && input.steamAppId === 1145360)
                ? null
                : scenario === "partial"
                  ? fixturePrices(input.steamAppId)
                  : {
                      ...fixturePrices(input.steamAppId),
                      currentPrice: 0,
                      historicalLow: null,
                      historicalLowSource: null,
                      source: scenario === "free" ? "steam" : "catalog",
                      deals: fixturePrices(input.steamAppId).deals.map(
                        (deal) => ({
                          ...deal,
                          price: 0,
                        }),
                      ),
                    },
          })),
      }),
    });
    await page.route("**/api/trpc/**getGamePrices**", async (route) => {
      const request = route.request();
      const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        router,
        createContext: () => ({}),
        req: new Request(request.url(), {
          headers: await request.allHeaders(),
        }),
      });
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    });
    await page.goto("/wishlist");
    const cards = page.locator(".watch-card");
    if (scenario === "offline") {
      // Keep requests deterministic while sending the browser's real connection events.
      await page.evaluate(() => {
        Object.defineProperty(navigator, "onLine", {
          configurable: true,
          get: () => false,
        });
        window.dispatchEvent(new Event("offline"));
      });
      await expect(page.getByText("Reconnect to check prices")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Check prices now" }),
      ).toHaveCount(0);
      const watch = cards.filter({
        has: page.getByRole("heading", { name: "Helldivers 2", exact: true }),
      });
      await expect(watch.locator(".watch-source")).toHaveText(
        "Checks when you’re back online",
      );
      await expect(watch.locator(".watch-decision")).toHaveText(
        "Target $25.00 saved",
      );
      await expect(watch.locator(".watch-steam-comparison")).toBeEmpty();
      await expect(watch).not.toContainText(/try checking|Couldn’t check/i);
      await expect(
        page.getByText(
          "Your targets are saved; prices refresh when you reconnect.",
          { exact: true },
        ),
      ).toBeVisible();
      await page.evaluate(() => {
        Object.defineProperty(navigator, "onLine", {
          configurable: true,
          get: () => true,
        });
        window.dispatchEvent(new Event("online"));
      });
      await expect(
        page.getByRole("button", { name: "Check prices now" }),
      ).toBeVisible();
    } else if (scenario === "unavailable" || scenario === "partial") {
      await expect(
        page.getByText(
          scenario === "unavailable"
            ? "Prices unavailable"
            : "1 at your price · 1 unchecked",
          { exact: true },
        ),
      ).toBeVisible();
      const unchecked =
        scenario === "unavailable"
          ? cards.first()
          : cards.filter({
              has: page.getByRole("heading", { name: "Hades", exact: true }),
            });
      await expect(
        unchecked.getByText("History unavailable", { exact: true }),
      ).toBeVisible();
      await expect(
        unchecked.getByText("Couldn’t check", { exact: true }),
      ).toBeVisible();
      await expect(unchecked.locator(".watch-current-price")).toHaveText("—");
      await expect(unchecked.locator(".watch-steam-comparison")).toBeEmpty();
      await expect(
        unchecked.locator('[data-alert-state="UNKNOWN"]'),
      ).toBeVisible();
    } else {
      const watch = cards.filter({
        has: page.getByRole("heading", { name: "Helldivers 2", exact: true }),
      });
      await expect(watch.locator(".watch-current-price")).toHaveText("Free");
      await expect(watch.locator('[data-field="target"]')).toContainText(
        "$25.00",
      );
      if (scenario === "free") {
        await expect(
          watch.getByText("Free right now; nothing to wait for"),
        ).toBeVisible();
        await expect(
          watch.getByRole("link", { name: "Get it free at Steam" }),
        ).toBeVisible();
        await expect(watch.locator(".watch-buy")).not.toHaveClass(/secondary/);
        await expect(watch.locator('[data-field="target"]')).toBeHidden();
        await expect(
          watch.locator('.price-track [data-mark="target"]'),
        ).toHaveCount(0);
      } else {
        await expect(
          watch.getByText("Previously free; check the store", { exact: true }),
        ).toBeVisible();
        await expect(
          watch.getByRole("link", { name: "Check price at Steam" }),
        ).toBeVisible();
        await expect(watch.locator(".watch-buy")).toHaveClass(/secondary/);
      }
    }
  });
}

const sessionCookie = {
  name: "better-auth.session_token",
  value: "playwright-session",
  url: "http://localhost:3000",
};
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
  // Signed-in browsers always carry the session cookie; the server uses it to
  // decide whether to wait for the session before rendering.
  await page.context().addCookies([sessionCookie]);
  await page.goto("/library");
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await expect(page.getByText("Showing sample games.")).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-json-btn").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("gemuzu-2026-10-22.json");
  const path = await download.path();
  if (!path) throw new Error("Missing download");
  expect(
    BacklogExportSchema.parse(JSON.parse(await readFile(path, "utf8"))),
  ).toEqual(backup);
  await page.getByTestId("nav-deals").click();
  // Hiding owned games is the default, so Cyberpunk is filtered out.
  await expect(page.getByTestId("deal-card")).toHaveCount(11);
  const owned = page.getByTestId("deal-card").filter({
    has: page.getByRole("heading", { name: "Featured Game 1", exact: true }),
  });
  await owned.getByRole("button", { name: "I own this", exact: true }).click();
  // The card stays put so purchase details can be added; nothing is assumed.
  await expect(page.getByTestId("deal-card")).toHaveCount(11);
  await expect(owned.getByText("Added to your library")).toBeVisible();
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
    .getByLabel("Completion status", { exact: true })
    .selectOption("completed");
  await expect(
    page.getByLabel("Completion status", { exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Watch the price/ }).click();
  await expect(page.getByTestId("nav-library")).toContainText("1");
  await page.getByLabel("Target price", { exact: true }).fill("7.50");
  await page.getByLabel("Target price", { exact: true }).press("Tab");
  await expect(page.getByRole("button", { name: /I own it/ })).toBeEnabled();
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
  await page.getByRole("button", { name: /I own it/ }).click();
  await expect(page.getByLabel("Amount paid", { exact: true })).toHaveValue(
    "12.34",
  );
  await expect(
    page.getByLabel("Completion status", { exact: true }),
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
  // Signed-in browsers always carry the session cookie; the server uses it to
  // decide whether to wait for the session before rendering.
  await page.context().addCookies([sessionCookie]);
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
  await expect(
    page.getByRole("link", { name: /^(Back to )?Library$/ }),
  ).toBeVisible();
  await expect(page.getByTestId("nav-library")).toContainText("3");
  await page.getByLabel("Amount paid", { exact: true }).fill("12.34");
  await page.getByLabel("Amount paid", { exact: true }).press("Tab");
  await expect(page.locator(".save-feedback")).toHaveText("Saved.");
  await page
    .getByLabel("Completion status", { exact: true })
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
  await page.getByRole("button", { name: /Watch the price/ }).click();
  await expect(page.getByTestId("nav-library")).toContainText("2");
  await page.getByLabel("Target price", { exact: true }).fill("7.50");
  await page.getByLabel("Target price", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Completion status", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Watch the price/ }),
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
  await expect(page.locator(".collection-counts")).toContainText("0 playing");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Paid, never played" }),
  ).toContainText("1 unplayed game");
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
    page.getByText("Price not recorded · plays on Steam (unconfirmed)", {
      exact: true,
    }),
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
    if (signedIn) await page.context().addCookies([sessionCookie]);
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
    await page.getByRole("button", { name: /Watch the price/ }).click();
    await expect(
      page.getByLabel("Target price", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Completion status", { exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Target price", { exact: true }).fill("7.50");
    await page.getByRole("button", { name: /I own it/ }).click();
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
    await page.getByRole("button", { name: /Watch the price/ }).click();
    await expect(page.getByLabel("Target price", { exact: true })).toHaveValue(
      "7.5",
    );
  });
}

test.describe("phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("edition rows wrap linked titles and keep prices beside them", async ({
    page,
  }) => {
    const offers = deals.slice(1, 3).map((deal, index) => ({
      ...deal,
      title:
        index === 0
          ? "LEGO Star Wars: The Skywalker Saga Deluxe Edition"
          : "Need for Speed Heat Deluxe Edition",
      steamAppId: index === 0 ? 1001 : null,
      storeId: "3",
      cheapestPrice: index === 0 ? 6.99 : 0,
      normalPrice: 3.99,
    }));
    await mockDealResults(page, offers, {});
    await page.goto("/deals");
    const rows = page.locator(".deal-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByRole("heading")).toHaveText(
      offers[0]?.title ?? "",
    );
    await expect(rows.nth(1).locator(".deal-price")).toHaveText("Free");
    const bounds = await rows.evaluateAll((elements) =>
      elements.map((element) => {
        const title = element.querySelector(".deal-title");
        const titleLink = title?.querySelector("a");
        const heading = element
          .querySelector(".deal-row-heading")
          ?.getBoundingClientRect();
        const price = element
          .querySelector(".deal-row-price")
          ?.getBoundingClientRect();
        const art = element
          .querySelector(".deal-row-art")
          ?.getBoundingClientRect();
        return {
          height: element.getBoundingClientRect().height,
          titleHeight: title?.getBoundingClientRect().height,
          titleLinkDisplay: titleLink
            ? getComputedStyle(titleLink).display
            : null,
          headingRight: heading?.right,
          priceLeft: price?.left,
          artWidth: art?.width,
          actionsHeight: element
            .querySelector(".deal-buy")
            ?.getBoundingClientRect().height,
        };
      }),
    );
    for (const row of bounds) {
      // ≤150px normally; a wrapped "Epic Games Store · Steam key" line adds ~20.
      expect(row.height).toBeLessThanOrEqual(170);
      expect(row.titleHeight).toBe(44);
      expect(row.headingRight).toBeLessThan(row.priceLeft ?? 0);
      expect(row.artWidth).toBe(96);
      expect(row.actionsHeight).toBeGreaterThanOrEqual(44);
    }
    expect(bounds[0]?.titleLinkDisplay).toBe("inline");
  });

  test("deal rows keep tracking behind Track and show where the price buys", async ({
    page,
  }) => {
    await page.goto("/deals");
    const card = page.getByTestId("deal-card").first();
    await expect(card.locator(".price-link-cue")).toHaveText(
      /at Epic Games Store ↗/,
    );
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
  await expect(page.locator(".deal-featured, .deal-ribbon")).toHaveCount(0);
  await expect(
    card.getByRole("link", { name: /^Saved price \$9\.99 at Steam/ }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: /Check price at/ }),
  ).toBeVisible();
  // Saved offers stay compact and never claim a live Steam comparison.
  await expect(card).toHaveClass("deal-row");
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
  // Signed-in browsers always carry the session cookie; the server uses it to
  // decide whether to wait for the session before rendering.
  await page.context().addCookies([sessionCookie]);
  await page.goto("/game/1091500");
  await page.getByRole("button", { name: /Watch the price/ }).click();
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
  await expect(panel.locator(".save-status")).toContainText("Saved");
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
  // announce "Saved"; retrying the store clears its error.
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
  await expect(panel.locator(".save-status-text.is-saved")).toHaveCount(0);
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
  // The confirmation names what was stored.
  await expect(panel.locator(".save-status")).toContainText(
    "Saved: Paid $6.00",
  );
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
  await page.setViewportSize({ width: 840, height: 900 });
  await page.goto("/patch/553850/1847920302234123");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("7.2.2");
  const glance = page.getByRole("region", { name: "Patch at a glance" });
  await expect(glance.locator(".patch-legend")).toContainText("1 nerf change");
  await expect(glance.locator(".patch-legend")).toContainText("2 buff changes");
  await expect(glance.locator(".glance-caption")).toContainText(
    "sorted automatically from the notes",
  );
  await expect(page.locator("#change-0-0")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Full patch notes" }),
  ).toHaveAttribute("aria-selected", "true");
  const firstChange = page.locator(".patch-changes li").first();
  await expect(firstChange).toBeVisible();
  expect(
    await firstChange.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    ),
  ).toBeLessThan(800);
  const browse = page.locator(".patch-browse");
  await expect(browse).not.toHaveAttribute("open", "");
  await browse.getByText("Browse by hero / item", { exact: true }).click();
  await expect(
    browse.getByRole("heading", { name: /Mostly buffed/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Quick read" }).click();
  await expect(
    page.getByText(/2 buffs, 1 nerf, and 1 fix across/),
  ).toBeVisible();
  // A tile jumps to that change in the full notes.
  await browse.getByRole("button", { name: "AMW-20 APEX" }).click();
  await expect(
    page.getByRole("tab", { name: "Full patch notes" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#change-0-0")).toBeFocused();
  await expect(page.locator("#change-0-0")).toContainText(
    "Decreased caliber from 60 to 20",
  );
  const comparison = page.locator("#change-0-0 .patch-change-values");
  await expect(comparison).toHaveText("60 → 20");
  await expect(comparison).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(comparison).toBeHidden();
  await expect(firstChange.locator(".patch-change-text")).toHaveText(
    "Decreased caliber from 60 to 20",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(comparison).toBeVisible();
  await page.setViewportSize({ width: 840, height: 900 });
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

for (const width of [390, 1440]) {
  test(`patch heroes keep readable dark surfaces in light theme at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("theme-mode", "light"));
    for (const appId of [1422450, 553850]) {
      await page.goto(`/patch/${appId}/1847920302234123`);
      await expect(page.locator("html")).toHaveClass(/light/);
      const hero = page.locator(".patch-hero");
      await expect(hero).toBeVisible();
      // Compact on phones (208px), 220px from the small breakpoint up.
      await expect(hero).toHaveCSS(
        "min-height",
        width < 640 ? "208px" : "220px",
      );
      await expect(hero).toHaveCSS("background-color", "rgb(18, 20, 17)");
      await expect(hero.locator("h1")).toHaveCSS("color", "rgb(242, 244, 235)");
      await expect(hero.locator(".patch-meta")).toHaveCSS(
        "color",
        "rgb(195, 201, 186)",
      );
      await expect(hero.getByRole("link", { name: "Read on Steam" })).toHaveCSS(
        "color",
        "rgb(242, 244, 235)",
      );
      const layers = await hero.evaluate((element) => {
        const art = element.querySelector(".patch-hero-art");
        return {
          art: art ? Number(getComputedStyle(art).zIndex) : 0,
          gradient: Number(getComputedStyle(element, "::before").zIndex),
        };
      });
      expect(layers.gradient).toBeGreaterThan(layers.art);
      expect(layers.gradient).toBeLessThan(0);
    }
  });
}

test("patch reader shows compact Deadlock values and a chip for every change", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/patch/1422450/1847920302234123");
  const rows = page.locator(".patch-changes li");
  await expect(rows).toHaveCount(4);
  await expect(rows.locator(".change-kind")).toHaveCount(4);

  const scorn = rows.filter({ hasText: "Scorn - Heal" });
  await expect(scorn.locator(".patch-change-values")).toHaveText("1.2x → 1.3x");
  await expect(scorn.locator(".patch-change-values")).toBeVisible();

  const sandBlast = rows.filter({ hasText: "Sand Blast" });
  await expect(sandBlast.locator(".patch-change-values")).toHaveCount(0);
  await expect(sandBlast.locator(".change-kind")).toHaveText("↻Change");

  const daggers = rows.filter({ hasText: "Radiant Daggers" });
  await expect(daggers.locator(".patch-change-values")).toHaveText("30m → 25m");
  await expect(daggers.locator(".patch-change-text")).toContainText(
    "(moved to T2)",
  );

  const terrors = rows.filter({ hasText: "Lurking Terrors" });
  await expect(terrors.locator(".change-kind")).toHaveAttribute(
    "data-kind",
    "buff",
  );
  await expect(terrors.locator(".patch-change-values")).toHaveText(
    "2s → 1.75s",
  );
});

test("guest quota failures preserve edits for export even after sample metadata changes", async ({
  page,
}) => {
  await page.goto("/library");
  await expect(page.getByTestId("library-card")).toHaveCount(3);
  await page.evaluate(() => {
    // Called below with an explicit `this`, so the unbound reference is safe.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "backlog-guest-v1")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  const card = page
    .getByTestId("library-card")
    .filter({ hasText: "Cyberpunk 2077" });
  await card.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Completed", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("alert").filter({ hasText: "Export a backup" }),
  ).toContainText("Export a backup");
  const downloading = page.waitForEvent("download");
  await page.getByTestId("export-json-btn").click();
  const path = await (await downloading).path();
  if (!path) throw new Error("Missing backup download");
  const data = BacklogExportSchema.parse(
    JSON.parse(await readFile(path, "utf8")),
  );
  expect(data.items.find((item) => item.steamAppId === 1091500)).toMatchObject({
    completionStatus: "completed",
  });
  expect(
    data.items.find((item) => item.steamAppId === 1091500)?.amountPaid,
  ).toBeUndefined();
});

test("valid backup server failures offer retry without blaming the file", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: signedInSession }),
  );
  // Signed-in browsers always carry the session cookie; the server uses it to
  // decide whether to wait for the session before rendering.
  await page.context().addCookies([sessionCookie]);
  await page.goto("/library");
  await expect(page.getByTestId("library-card")).toHaveCount(1);
  await page.route("**/api/trpc/**importBacklogJson**", (route) =>
    route.fulfill({ status: 500, body: "{}" }),
  );
  const file = {
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  };
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles(file);
  await expect(page.locator(".backup-panel").getByRole("status")).toContainText(
    "Your file is valid",
  );
  await page.unroute("**/api/trpc/**importBacklogJson**");
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles(file);
  await expect(page.locator(".backup-panel").getByRole("status")).toHaveText(
    "Backup restored.",
  );
  browserErrors.get(page)?.splice(0);
});

for (const width of [390, 1440]) {
  test(`core routes fit ${width}px and search supports keyboard dismissal`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/deals",
      "/library",
      "/wishlist",
      "/updates",
      "/game/1091500",
      "/patch/553850/1847920302234123",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add game", exact: true }).first(),
      ).toBeEnabled();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `${route.replaceAll("/", "_") || "home"}.png`,
        ),
        fullPage: true,
        caret: "initial",
      });
    }
    await page
      .getByRole("button", { name: "Add game", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("Search games"),
    ).toBeFocused();
    await page.getByRole("dialog").getByLabel("Search games").fill("Dota");
    await expect(
      page.getByRole("dialog").getByText("Dota 2", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("search.png"),
      caret: "initial",
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add game", exact: true }).first(),
    ).toBeFocused();
  });
}

test("Riot games can be added, run in the Riot Client and link to Riot's notes", async ({
  page,
}) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Add game" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search games").fill("lol");
  const result = dialog.getByRole("listitem").filter({
    has: page.getByText("League of Legends", { exact: true }),
  });
  await expect(result.getByText(/Free to play · Riot Client/)).toBeVisible();
  // Free games have no price to watch.
  await expect(
    result.getByRole("button", { name: /^Wishlist: add League of Legends/ }),
  ).toHaveCount(0);
  await result
    .getByRole("button", {
      name: "I own it: add League of Legends to library",
      exact: true,
    })
    .click();
  await expect(dialog.getByText("Added to your library")).toBeVisible();
  await expect(
    dialog
      .getByLabel("Launcher League of Legends plays on", { exact: true })
      .locator("option:checked"),
  ).toHaveText("Riot Client");
  await page.keyboard.press("Escape");

  const riot = riotGame(2_000_000_001);
  await page.goto("/game/2000000001");
  await expect(page.locator(".hub-price")).toHaveText("Free");
  await expect(page.getByText("Plays on Riot Client.")).toBeVisible();
  await expect(page.getByTestId("launch-game-btn")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /^League of Legends site/ }),
  ).toHaveAttribute("href", riot?.site ?? "");
  const read = page.getByRole("link", { name: /^Read on Riot Games/ }).first();
  await expect(read).toHaveAttribute(
    "href",
    /^https:\/\/www\.leagueoflegends\.com\//,
  );
  await expect(page.getByText("Include community and press posts")).toHaveCount(
    0,
  );
});
