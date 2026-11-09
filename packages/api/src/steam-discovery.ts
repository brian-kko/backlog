import { z } from "zod/v4";

import type { GameSearchResult } from "@acme/validators";
import {
  classifyAndCleanSteamNews,
  cleanSteamText,
  DealItemSchema,
  isPromotionalNews,
  parseSteamStoreSearch,
  SearchDealsInputSchema,
} from "@acme/validators";

import { catalogVerifiedAt, curatedGames } from "./curated-games";

const jsonCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingJson = new Map<string, Promise<unknown>>();
const cacheTtlMs = 5 * 60 * 1000;

// All upstream I/O, including reading JSON, has a deadline and fails closed into
// the next provider. Provider outages must never become failed public tRPC calls.
async function fetchJson(url: string): Promise<unknown> {
  const cached = jsonCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  jsonCache.delete(url);
  // Share the first request too, before a response is available to cache.
  const pending = pendingJson.get(url);
  if (pending) return pending;

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "BacklogApp/1.0" },
      });
      if (!response.ok) return null;
      const value: unknown = await response.json();
      jsonCache.set(url, { expiresAt: Date.now() + cacheTtlMs, value });
      return value;
    } catch {
      // Do not cache failures, so the next call can recover immediately.
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })();
  pendingJson.set(url, request);
  try {
    return await request;
  } finally {
    pendingJson.delete(url);
  }
}

const newsItemSchema = z.object({
  gid: z.string(),
  title: z.string(),
  contents: z.string(),
  url: z.string(),
  date: z.number(),
  tags: z.array(z.string()).optional(),
  feedlabel: z.string().optional(),
  feedname: z.string().optional(),
  feed_type: z.number().optional(),
});
const newsSchema = z.object({
  appnews: z.object({ newsitems: z.array(z.unknown()).default([]) }),
});

export async function fetchSteamFeed(steamAppId: number) {
  const data = newsSchema.safeParse(
    await fetchJson(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${steamAppId}&count=30&maxlength=0&format=json&l=english`,
    ),
  );
  // Distinguishes "Steam couldn't be reached" from "no recent posts".
  const available = data.success;
  const english = (data.success ? data.data.appnews.newsitems : [])
    .flatMap((item) => {
      const parsed = newsItemSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    })
    .filter((item) => !isPromotionalNews(item))
    .filter(
      (item) =>
        !/[\u0400-\u04FF]/.test(
          item.title +
            item.contents +
            cleanSteamText(item.title + " " + item.contents),
        ),
    )
    .sort((a, b) => b.date - a.date);
  const isOfficial = (item: z.infer<typeof newsItemSchema>) =>
    item.feedname === "steam_community_announcements" || item.feed_type === 1;
  const official = english.filter(isOfficial);
  // Only supplement a sparse official feed, and keep official posts first.
  const selected =
    official.length >= 4
      ? official
      : [
          ...official,
          ...english
            .filter((item) => !isOfficial(item))
            .slice(0, 4 - official.length),
        ];
  const items = selected.map((item) => ({
    id: item.gid,
    steamAppId,
    title: cleanSteamText(item.title),
    official: isOfficial(item),
    url: item.url,
    publishedAt: new Date(item.date * 1000),
    ...classifyAndCleanSteamNews(item),
  }));
  return {
    available,
    patchNotes: items.filter((item) => item.category === "patch_note"),
    events: items.filter((item) => item.category !== "patch_note"),
  };
}

// Empty strings and null are missing prices, never a free offer.
const providerPrice = z
  .union([z.string().trim().min(1), z.number()])
  .pipe(z.coerce.number<string | number>().nonnegative());
const providerAppId = z.union([z.string(), z.number()]).nullish();
const dealSchema = z.object({
  dealID: z.string(),
  title: z.string(),
  salePrice: z.unknown().optional(),
  normalPrice: z.unknown().optional(),
  savings: z.unknown().optional(),
  steamAppID: providerAppId,
  thumb: z.string().default(""),
  storeID: z.string().optional(),
});
const savings = (price: number, normal: number) =>
  normal > 0 ? Math.max(0, (1 - price / normal) * 100) : 0;
const storeUrl = (id: number) => `https://store.steampowered.com/app/${id}/`;
const dealUrl = (id: string) => {
  // CheapShark sometimes supplies an already percent-encoded ID.
  try {
    return `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(decodeURIComponent(id))}`;
  } catch {
    return `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(id)}`;
  }
};

const steamGameSchema = z.object({
  name: z.string(),
  is_free: z.boolean().optional(),
  short_description: z.string().optional(),
  header_image: z.string().optional(),
  developers: z.array(z.string()).optional(),
  genres: z.array(z.object({ description: z.string() })).optional(),
  price_overview: z
    .object({
      currency: z.literal("USD"),
      initial: z.coerce.number().nonnegative(),
      final: z.coerce.number().nonnegative(),
    })
    .nullish()
    .catch(undefined),
});
type SteamGame = z.infer<typeof steamGameSchema>;

export async function fetchGameMetadata(
  steamAppId: number,
): Promise<SteamGame | null> {
  const response = z
    .record(
      z.string(),
      z.object({
        success: z.boolean(),
        data: z.unknown().optional(),
      }),
    )
    .safeParse(
      await fetchJson(
        `https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=us&l=en&filters=price_overview,basic`,
      ),
    );
  const game = response.success ? response.data[String(steamAppId)] : null;
  const parsed = steamGameSchema.safeParse(game?.success ? game.data : null);
  if (parsed.success) return parsed.data;
  const cached = curatedGames.find((item) => item.steamAppId === steamAppId);
  return cached ? { name: cached.title, header_image: cached.thumb } : null;
}

function steamPrice(game: SteamGame | null) {
  if (game?.is_free) return { current: 0, normal: 0 };
  return game?.price_overview
    ? {
        current: game.price_overview.final / 100,
        normal: game.price_overview.initial / 100,
      }
    : null;
}

export async function fetchDeals(
  query?: string,
  options?: z.infer<typeof SearchDealsInputSchema>,
) {
  return (await fetchDealsWithStatus(query, options)).offers;
}

/**
 * Deals plus whether live stores answered. `live: false` means these are saved
 * catalog offers (or nothing) because the provider was unreachable.
 */
export async function fetchDealsWithStatus(
  query?: string,
  options?: z.infer<typeof SearchDealsInputSchema>,
) {
  const title = query?.trim() ?? "";
  const configured = Object.keys(options ?? {}).some((key) => key !== "query");
  let url = title
    ? `https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(title)}&pageSize=12`
    : "https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=50&pageSize=12";
  if (configured) {
    const params = new URLSearchParams({
      pageSize: String(options?.pageSize ?? 60),
      pageNumber: String(options?.page ?? 0),
    });
    if (title) params.set("title", title);
    if (options?.storeIds?.length)
      params.set("storeID", [...options.storeIds].sort().join(","));
    if (options?.maxPrice !== undefined)
      params.set("upperPrice", String(options.maxPrice));
    if (options?.steamOnly) params.set("steamworks", "1");
    if (options?.onSale) params.set("onSale", "1");
    const sorts = {
      deals: "DealRating",
      price: "Price",
      savings: "Savings",
      title: "Title",
      recent: "Recent",
    };
    params.set("sortBy", sorts[options?.sort ?? "deals"]);
    // CheapShark's native Savings/Recent order is already highest/newest first.
    // desc=1 reverses that order, rather than universally meaning descending.
    url = `https://www.cheapshark.com/api/1.0/deals?${params}`;
  }
  const response = await fetchJson(url);
  const rows = Array.isArray(response) ? (response as unknown[]) : [];
  const deals = (
    await Promise.all(
      rows.map(async (row) => {
        const parsed = dealSchema.safeParse(row);
        if (!parsed.success) return null;
        const deal = parsed.data;
        const id = Number(deal.steamAppID);
        const steamAppId = Number.isInteger(id) && id > 0 ? id : null;
        const price = providerPrice.safeParse(deal.salePrice);
        const retail = providerPrice.safeParse(deal.normalPrice);
        const discount = providerPrice.safeParse(deal.savings);
        const fallback =
          !price.success && steamAppId
            ? await fetchPriceFallback(steamAppId)
            : null;
        const cheapestPrice = price.success
          ? price.data
          : fallback?.currentPrice;
        if (cheapestPrice == null) return null;
        const normalPrice = retail.success
          ? retail.data
          : (fallback?.deals[0]?.retailPrice ?? cheapestPrice);
        const item = DealItemSchema.safeParse({
          id: deal.dealID,
          title: deal.title,
          cheapestPrice,
          normalPrice,
          savingsPercent:
            price.success && discount.success
              ? discount.data
              : savings(cheapestPrice, normalPrice),
          steamAppId,
          thumb: deal.thumb,
          ...(fallback ? { source: fallback.source } : {}),
          ...(deal.storeID
            ? { storeId: fallback?.deals[0]?.storeID ?? deal.storeID }
            : {}),
          url: fallback?.deals[0]?.url ?? dealUrl(deal.dealID),
          steamRedeemable: fallback
            ? fallback.deals[0]?.storeID === "1"
            : deal.storeID === "1" || Boolean(options?.steamOnly),
        });
        return item.success ? item.data : null;
      }),
    )
  ).filter((item) => item !== null);
  const live = Array.isArray(response);
  if (deals.length) return { offers: deals, live: true };
  if (configured && live && rows.length === 0) return { offers: [], live };
  // Preserve search semantics during an outage; do not show unrelated titles.
  const catalog = curatedGames.filter((item) =>
    item.title.toLowerCase().includes(title.toLowerCase()),
  );
  if ((options?.page ?? 0) > 0) return { offers: [], live };
  const fallbackDeals = catalog
    .filter(
      (item) =>
        (!options?.storeIds?.length ||
          options.storeIds.some((id) => id === item.storeID)) &&
        (options?.maxPrice === undefined ||
          item.salePrice <= options.maxPrice) &&
        (!options?.steamOnly || item.storeID === "1") &&
        (!options?.onSale || item.salePrice < item.normalPrice),
    )
    .map((item) =>
      DealItemSchema.parse({
        id: `catalog-${item.steamAppId}`,
        title: item.title,
        cheapestPrice: item.salePrice,
        normalPrice: item.normalPrice,
        savingsPercent: savings(item.salePrice, item.normalPrice),
        steamAppId: item.steamAppId,
        thumb: item.thumb,
        source: "catalog",
        storeId: item.storeID,
        url: dealUrl(item.dealID),
        steamRedeemable: item.storeID === "1",
      }),
    );
  return {
    live,
    offers: fallbackDeals.sort((a, b) =>
      options?.sort === "price"
        ? a.cheapestPrice - b.cheapestPrice
        : options?.sort === "savings"
          ? b.savingsPercent - a.savingsPercent
          : options?.sort === "title"
            ? a.title.localeCompare(b.title)
            : 0,
    ),
  };
}

const steamPriceMap = z.record(
  z.string(),
  z.object({
    success: z.boolean(),
    data: z
      .union([
        z.object({
          price_overview: z
            .object({ final: z.number(), initial: z.number() })
            .optional(),
        }),
        z.array(z.unknown()),
      ])
      .optional(),
  }),
);

/**
 * Steam's current USD price for many games in one request (appdetails accepts
 * several AppIDs when filtered to price_overview). Missing prices are omitted.
 */
export async function fetchSteamPrices(steamAppIds: number[]) {
  const ids = [...new Set(steamAppIds)].sort((a, b) => a - b);
  if (!ids.length) return {};
  const parsed = steamPriceMap.safeParse(
    await fetchJson(
      `https://store.steampowered.com/api/appdetails?appids=${ids.join(",")}&cc=us&filters=price_overview`,
    ),
  );
  if (!parsed.success) return {};
  const prices: Record<number, number> = {};
  for (const id of ids) {
    const entry = parsed.data[String(id)];
    const data = entry?.success && !Array.isArray(entry.data) ? entry.data : null;
    if (data?.price_overview) prices[id] = data.price_overview.final / 100;
  }
  return prices;
}

const priceDealSchema = z.object({
  storeID: z.string(),
  dealID: z.string(),
  price: providerPrice,
  retailPrice: providerPrice,
  savings: providerPrice,
});
const gamePricesSchema = z.object({
  info: z.object({
    title: z.string(),
    steamAppID: providerAppId,
    thumb: z.string().optional(),
  }),
  cheapestPriceEver: z
    .object({ price: providerPrice })
    .nullish()
    .catch(undefined),
  deals: z.array(z.unknown()).default([]),
});

async function fetchPriceFallback(
  steamAppId: number,
  metadata?: Promise<SteamGame | null>,
) {
  const game = await (metadata ?? fetchGameMetadata(steamAppId));
  const live = steamPrice(game);
  const cached = curatedGames.find((item) => item.steamAppId === steamAppId);
  if (!live && !cached) return null;
  const currentPrice = live?.current ?? cached!.salePrice;
  const retailPrice = live?.normal ?? cached!.normalPrice;
  return {
    title: game?.name ?? cached!.title,
    currentPrice,
    steamPrice: live?.current ?? null,
    // Steam has no historical API. Preserve that distinction for non-catalog games.
    historicalLow: cached ? Math.min(cached.historicalLow, currentPrice) : null,
    historicalLowSource: cached ? ("catalog" as const) : null,
    historicalLowAsOf: cached ? catalogVerifiedAt : null,
    source: live ? ("steam" as const) : ("catalog" as const),
    verifiedAt: live ? new Date().toISOString() : catalogVerifiedAt,
    deals: [
      {
        storeID: live ? "1" : cached!.storeID,
        dealID: live ? `steam-${steamAppId}` : cached!.dealID,
        price: currentPrice,
        retailPrice,
        savings: savings(currentPrice, retailPrice),
        url: live ? storeUrl(steamAppId) : dealUrl(cached!.dealID),
      },
    ],
  };
}

export async function fetchGamePrices(
  steamAppId: number,
  metadata?: Promise<SteamGame | null>,
) {
  const matches = z
    .array(z.object({ gameID: z.string() }))
    .safeParse(
      await fetchJson(
        `https://www.cheapshark.com/api/1.0/games?steamAppID=${steamAppId}`,
      ),
    );
  const match = matches.success ? matches.data[0] : null;
  const parsed = match
    ? gamePricesSchema.safeParse(
        await fetchJson(
          `https://www.cheapshark.com/api/1.0/games?id=${encodeURIComponent(match.gameID)}`,
        ),
      )
    : null;
  if (parsed?.success) {
    const data = parsed.data;
    const deals = data.deals
      .flatMap((row) => {
        const deal = priceDealSchema.safeParse(row);
        return deal.success
          ? [{ ...deal.data, url: dealUrl(deal.data.dealID) }]
          : [];
      })
      .sort((a, b) => a.price - b.price);
    const currentPrice = deals[0]?.price;
    if (currentPrice != null) {
      // Steam is the baseline users compare against. When CheapShark has no
      // Steam offer, fetch Steam's own price and compete it with the others.
      const steamDeal = deals.find((deal) => deal.storeID === "1");
      const steamLive = steamDeal
        ? null
        : steamPrice(await (metadata ?? fetchGameMetadata(steamAppId)));
      if (steamLive) {
        deals.push({
          storeID: "1",
          dealID: `steam-${steamAppId}`,
          price: steamLive.current,
          retailPrice: steamLive.normal,
          savings: savings(steamLive.current, steamLive.normal),
          url: storeUrl(steamAppId),
        });
        deals.sort((a, b) => a.price - b.price);
      }
      const steam = steamDeal?.price ?? steamLive?.current ?? null;
      const best = deals[0]?.price ?? currentPrice;
      const recordedLow = data.cheapestPriceEver?.price;
      const catalogLow = curatedGames.find(
        (item) => item.steamAppId === steamAppId,
      )?.historicalLow;
      const historicalLow = recordedLow ?? catalogLow;
      return {
        title: data.info.title,
        currentPrice: best,
        historicalLow:
          historicalLow == null ? null : Math.min(historicalLow, best),
        // Where "lowest ever" comes from: the live price history, or a saved
        // catalog snapshot that may be out of date.
        historicalLowSource:
          recordedLow != null
            ? ("cheapshark" as const)
            : catalogLow != null
              ? ("catalog" as const)
              : null,
        historicalLowAsOf: recordedLow == null && catalogLow != null ? catalogVerifiedAt : null,
        deals,
        steamPrice: steam,
        source: "cheapshark" as const,
        verifiedAt: new Date().toISOString(),
      };
    }
  }
  return fetchPriceFallback(steamAppId, metadata);
}

const storeHeader = (id: number) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;

// Public title search for adding any game, not just games currently on sale.
// When Steam is unreachable, saved catalog titles are offered without prices.
export async function searchGames(query: string): Promise<{
  source: "steam" | "catalog";
  results: GameSearchResult[];
}> {
  const response = await fetchJson(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`,
  );
  if (response !== null) {
    const results = parseSteamStoreSearch(response).slice(0, 10);
    // Steam's search lists soundtracks, tools and videos as "apps". Ask Steam
    // what each result is; keep games and DLC. Lookups that fail keep the row.
    const kinds = await Promise.all(
      results.map((game) => fetchAppType(game.steamAppId)),
    );
    return {
      source: "steam",
      results: results.filter((_, index) => {
        const kind = kinds[index];
        return kind == null || kind === "game" || kind === "dlc";
      }),
    };
  }
  const needle = query.toLowerCase();
  return {
    source: "catalog",
    results: curatedGames
      .filter((game) => game.title.toLowerCase().includes(needle))
      .map((game) => ({
        steamAppId: game.steamAppId,
        title: game.title,
        image: storeHeader(game.steamAppId),
        price: null,
      })),
  };
}

const appTypeSchema = z.record(
  z.string(),
  z.object({
    success: z.boolean(),
    data: z.object({ type: z.string() }).optional(),
  }),
);

/** Steam's own type for an app ("game", "dlc", "music", …), if known. */
async function fetchAppType(steamAppId: number) {
  const parsed = appTypeSchema.safeParse(
    await fetchJson(
      `https://store.steampowered.com/api/appdetails?appids=${steamAppId}&filters=basic`,
    ),
  );
  const entry = parsed.success ? parsed.data[String(steamAppId)] : undefined;
  return entry?.success ? (entry.data?.type ?? null) : null;
}

// Merges official posts across the user's games, newest first.
export async function fetchCollectionFeed(steamAppIds: number[], limit: number) {
  const ids = [...new Set(steamAppIds)];
  const feeds = await Promise.all(ids.map((id) => fetchSteamFeed(id)));
  const newest = <T extends { publishedAt: Date; official: boolean }>(
    items: T[],
  ) =>
    items
      .filter((item) => item.official)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, limit);
  // Limited per category, so busy announcement feeds can't crowd out patches.
  return {
    unavailable: ids.filter((_, index) => !feeds[index]?.available),
    items: [
      ...newest(feeds.flatMap((feed) => feed.patchNotes)),
      ...newest(feeds.flatMap((feed) => feed.events)),
    ].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()),
  };
}
