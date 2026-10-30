import { expect, test } from "@playwright/test";

import {
  fetchDeals,
  fetchGameMetadata,
  fetchGamePrices,
  fetchSteamFeed,
} from "../../../packages/api/src/steam-discovery";

// Expire module-local response caches between tests without production reset APIs.
const realNow = Date.now;
let timeOffset = 0;
test.beforeEach(() => {
  timeOffset += 10 * 60 * 1000;
  Date.now = () => realNow() + timeOffset;
});
test.afterEach(() => {
  Date.now = realNow;
});

test("Steam adapter requests 30 posts and retains general announcements in events", async () => {
  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = (input) => {
    requested = input instanceof Request ? input.url : input.toString();
    return Promise.resolve(
      Response.json({
        appnews: {
          newsitems: [
            {
              gid: "patch",
              title: "From the team",
              contents: "[b]Version v3[/b] fixes are ready.",
              url: "https://steamcommunity.com/patch",
              date: 100,
            },
            {
              gid: "event",
              title: "Join us",
              contents: "[h1]Anniversary DLC[/h1]",
              url: "https://steamcommunity.com/event",
              date: 200,
            },
            {
              gid: "general",
              title: "A letter",
              contents: "[b]Thanks for playing![/b]",
              url: "https://steamcommunity.com/letter",
              date: 300,
            },
          ],
        },
      }),
    );
  };
  try {
    const feed = await fetchSteamFeed(730);
    expect(new URL(requested).searchParams.get("count")).toBe("30");
    expect(new URL(requested).searchParams.get("appid")).toBe("730");
    expect(feed.patchNotes.map((item) => item.id)).toEqual(["patch"]);
    expect(feed.events.map((item) => item.id)).toEqual(["general", "event"]);
    expect(feed.events[0]).toMatchObject({
      category: "general",
      cleanSummary: "Thanks for playing!",
      steamAppId: 730,
    });
    expect(feed.patchNotes[0]?.cleanSummary).toBe(
      "Version v3 fixes are ready.",
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("CheapShark featured and searched deals normalize numeric prices and AppIDs", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (input) => {
    requests.push(input instanceof Request ? input.url : input.toString());
    return Promise.resolve(
      Response.json([
        {
          dealID: "a&b",
          title: "Cyberpunk 2077",
          salePrice: "29.99",
          normalPrice: "59.99",
          savings: "50.01",
          steamAppID: "1091500",
          thumb: "https://example.com/game.jpg",
        },
        {
          dealID: "non-steam",
          title: "A bundle",
          salePrice: "0",
          normalPrice: "10",
          savings: "100",
          steamAppID: null,
          thumb: "https://example.com/bundle.jpg",
        },
      ]),
    );
  };
  try {
    for (const query of [undefined, "", "  "]) {
      const deals = await fetchDeals(query);
      expect(deals[0]).toMatchObject({
        id: "a&b",
        title: "Cyberpunk 2077",
        cheapestPrice: 29.99,
        normalPrice: 59.99,
        savingsPercent: 50.01,
        steamAppId: 1091500,
        thumb: "https://example.com/game.jpg",
      });
      expect(deals[1]).toMatchObject({ steamAppId: null, cheapestPrice: 0 });
    }
    expect(requests).toEqual(
      Array(1).fill(
        "https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=50&pageSize=12",
      ),
    );
    await fetchDeals("  Portal & friends  ");
    expect(new URL(requests[1] ?? "").searchParams.get("title")).toBe(
      "Portal & friends",
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("game adapters retrieve Steam metadata and sort CheapShark price details", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (input) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    if (url.hostname === "store.steampowered.com") {
      expect(url.searchParams.get("appids")).toBe("1091500");
      return Promise.resolve(
        Response.json({
          "1091500": {
            success: true,
            data: {
              name: "Cyberpunk 2077",
              short_description: "Explore Night City",
              developers: ["CD PROJEKT RED"],
            },
          },
        }),
      );
    }
    if (url.searchParams.has("steamAppID")) {
      expect(url.searchParams.get("steamAppID")).toBe("1091500");
      return Promise.resolve(Response.json([{ gameID: "42" }]));
    }
    expect(url.searchParams.get("id")).toBe("42");
    return Promise.resolve(
      Response.json({
        info: { title: "Cyberpunk 2077", steamAppID: "1091500", thumb: "" },
        cheapestPriceEver: { price: "19.99" },
        deals: [
          {
            storeID: "1",
            dealID: "expensive",
            price: "29.99",
            retailPrice: "59.99",
            savings: "50",
          },
          {
            storeID: "2",
            dealID: "cheap&deal",
            price: "24.99",
            retailPrice: "59.99",
            savings: "58",
          },
        ],
      }),
    );
  };
  try {
    expect(await fetchGameMetadata(1091500)).toMatchObject({
      name: "Cyberpunk 2077",
      developers: ["CD PROJEKT RED"],
    });
    const prices = await fetchGamePrices(1091500);
    expect(prices).toMatchObject({ currentPrice: 24.99, historicalLow: 19.99 });
    expect(prices?.deals[0]?.url).toBe(
      "https://www.cheapshark.com/redirect?dealID=cheap%26deal",
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("adapters recover from unavailable providers and preserve missing games", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = () =>
      Promise.resolve(new Response("Unavailable", { status: 503 }));
    const deals = await fetchDeals();
    expect(deals).toHaveLength(12);
    expect(
      deals.every(
        (item) => item.cheapestPrice >= 0 && item.source === "catalog",
      ),
    ).toBe(true);
    expect(await fetchSteamFeed(730)).toEqual({ patchNotes: [], events: [] });
    expect(await fetchGamePrices(1091500)).toMatchObject({
      title: "Cyberpunk 2077",
      currentPrice: 17.99,
      historicalLow: 17.99,
      source: "catalog",
    });
    globalThis.fetch = () => Promise.resolve(Response.json([]));
    expect(await fetchDeals()).toHaveLength(12);
    expect(await fetchDeals("Cyberpunk")).toMatchObject([
      { title: "Cyberpunk 2077", cheapestPrice: 17.99 },
    ]);
    expect(await fetchGamePrices(1234)).toBeNull();
    globalThis.fetch = () =>
      Promise.resolve(Response.json({ "1234": { success: false } }));
    expect(await fetchGameMetadata(1234)).toBeNull();
  } finally {
    globalThis.fetch = original;
  }
});

test("news excludes Cyrillic and prioritizes official posts over newer syndication", async () => {
  const original = globalThis.fetch;
  const post = (gid: string, extra = {}) => ({
    gid,
    title: "Patch notes",
    contents: "&quot;Fixes&quot; &amp; improvements https://spam.test/",
    url: "https://steamcommunity.com/post",
    date: 100,
    ...extra,
  });
  let officialCount = 4;
  globalThis.fetch = () =>
    Promise.resolve(
      Response.json({
        appnews: {
          newsitems: [
            post("russian-title", { title: "Новости", feed_type: 1 }),
            post("russian-body", { contents: "Привет", feed_type: 1 }),
            post("encoded-russian", { contents: "&#1055;ривет", feed_type: 1 }),
            post("blog", { date: 1000 }),
            ...Array.from({ length: officialCount }, (_, i) =>
              post(
                `official-${i}`,
                i % 2
                  ? { feed_type: 1 }
                  : { feedname: "steam_community_announcements" },
              ),
            ),
          ],
        },
      }),
    );
  try {
    let feed = await fetchSteamFeed(730);
    expect(feed.patchNotes.map((item) => item.id)).toEqual([
      "official-0",
      "official-1",
      "official-2",
      "official-3",
    ]);
    expect(feed.patchNotes[0]?.cleanSummary).toBe('"Fixes" & improvements');
    officialCount = 2;
    timeOffset += 5 * 60 * 1000 + 1;
    feed = await fetchSteamFeed(730);
    expect(feed.patchNotes.map((item) => item.id)).toEqual([
      "official-0",
      "official-1",
      "blog",
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test("rate limits, invalid JSON and network failures use Steam then verified catalog", async () => {
  const original = globalThis.fetch;
  let steamOnline = true;
  globalThis.fetch = (input, init) => {
    expect(new Headers(init?.headers).get("User-Agent")).toBe("BacklogApp/1.0");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    if (url.hostname === "store.steampowered.com" && steamOnline) {
      expect(url.searchParams.get("cc")).toBe("us");
      expect(url.searchParams.get("l")).toBe("en");
      expect(url.searchParams.get("filters")).toBe("price_overview,basic");
      return Promise.resolve(
        Response.json({
          "1091500": {
            success: true,
            data: {
              name: "Cyberpunk 2077",
              price_overview: { currency: "USD", initial: 5999, final: 2999 },
            },
          },
        }),
      );
    }
    return Promise.resolve(new Response("Rate limited", { status: 429 }));
  };
  try {
    expect(await fetchGamePrices(1091500)).toMatchObject({
      currentPrice: 29.99,
      historicalLow: 17.99,
      source: "steam",
    });
    expect(await fetchDeals("cyberpunk")).toMatchObject([
      { cheapestPrice: 17.99, source: "catalog" },
    ]);
    steamOnline = false;
    timeOffset += 5 * 60 * 1000 + 1;
    expect(await fetchGamePrices(1091500)).toMatchObject({
      currentPrice: 17.99,
      source: "catalog",
    });
    expect(await fetchDeals("no such game")).toEqual([]);
    globalThis.fetch = () => Promise.resolve(new Response("not JSON"));
    expect(await fetchDeals()).toHaveLength(12);
    globalThis.fetch = () => Promise.reject(new TypeError("fetch failed"));
    expect(await fetchDeals()).toHaveLength(12);
    expect(await fetchSteamFeed(730)).toEqual({ patchNotes: [], events: [] });
  } finally {
    globalThis.fetch = original;
  }
});

test("missing deal prices recover without treating null or empty strings as free", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (input) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    return Promise.resolve(
      Response.json(
        url.hostname === "www.cheapshark.com"
          ? [
              {
                dealID: "missing",
                title: "Cyberpunk 2077",
                steamAppID: 1091500,
                salePrice: null,
              },
              {
                dealID: "bundle",
                title: "A bundle",
                steamAppID: null,
                salePrice: "0",
                normalPrice: "10",
                savings: "100",
              },
              { dealID: "empty", title: "A bundle", salePrice: "" },
              { nonsense: true },
            ]
          : {
              "1091500": {
                success: true,
                data: {
                  name: "Cyberpunk 2077",
                  price_overview: {
                    currency: "USD",
                    initial: "5999",
                    final: "2999",
                  },
                },
              },
            },
      ),
    );
  };
  try {
    expect(await fetchDeals()).toMatchObject([
      { cheapestPrice: 29.99, steamAppId: 1091500, source: "steam" },
      { cheapestPrice: 0, steamAppId: null },
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test("external fetches abort at 2.5 seconds and return the catalog", async () => {
  const original = globalThis.fetch;
  let aborted = false;
  globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(new DOMException("Timed out", "AbortError"));
        },
        { once: true },
      );
    });
  try {
    const start = Date.now();
    // One timed request; metadata and price fetches use this same deadline helper.
    expect(await fetchGameMetadata(1091500)).toMatchObject({
      name: "Cyberpunk 2077",
    });
    expect(aborted).toBe(true);
    expect(Date.now() - start).toBeGreaterThanOrEqual(2400);
    expect(Date.now() - start).toBeLessThan(3500);
  } finally {
    globalThis.fetch = original;
  }
});

test("catalog fallback makes no Steam requests", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (input) => {
    requests.push(input instanceof Request ? input.url : input.toString());
    return Promise.resolve(new Response("Rate limited", { status: 429 }));
  };
  try {
    const deals = await fetchDeals();
    expect(deals).toHaveLength(12);
    expect(deals.every((item) => item.source === "catalog")).toBe(true);
    expect(requests).toEqual([
      "https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=50&pageSize=12",
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test("Steam and CheapShark responses share concurrent requests and expire after five minutes", async () => {
  const original = globalThis.fetch;
  const previousNow = Date.now;
  let now = Date.now();
  Date.now = () => now;
  let calls = 0;
  globalThis.fetch = (input) => {
    calls++;
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    return Promise.resolve(
      Response.json(
        url.hostname === "store.steampowered.com"
          ? { "99999001": { success: true, data: { name: "Cached Game" } } }
          : [
              {
                dealID: "cached",
                title: "Cached Game",
                salePrice: "9.99",
                normalPrice: "19.99",
                savings: "50",
                steamAppID: null,
              },
            ],
      ),
    );
  };
  try {
    const read = () =>
      Promise.all([fetchGameMetadata(99999001), fetchDeals("cache-ttl")]);
    await Promise.all(Array.from({ length: 10 }, read));
    expect(calls).toBe(2);
    now += 5 * 60 * 1000 - 1;
    const [metadata, deals] = await read();
    expect(metadata?.name).toBe("Cached Game");
    expect(deals[0]?.cheapestPrice).toBe(9.99);
    expect(calls).toBe(2);
    now += 1;
    await read();
    expect(calls).toBe(4);
  } finally {
    globalThis.fetch = original;
    Date.now = previousNow;
  }
});

test("failed responses are retried instead of cached for five minutes", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(
      calls === 1
        ? new Response("Rate limited", { status: 429 })
        : Response.json({
            "99999002": { success: true, data: { name: "Recovered Game" } },
          }),
    );
  };
  try {
    expect(await fetchGameMetadata(99999002)).toBeNull();
    expect(await fetchGameMetadata(99999002)).toMatchObject({
      name: "Recovered Game",
    });
    expect(calls).toBe(2);
  } finally {
    globalThis.fetch = original;
  }
});

test("combined filters request the chosen stores, Steam activation and page upstream", async () => {
  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = (input) => {
    requested = input instanceof Request ? input.url : input.toString();
    return Promise.resolve(
      Response.json([
        {
          dealID: "filtered",
          title: "Hades",
          storeID: "1",
          steamAppID: "1145360",
          salePrice: "9.99",
          normalPrice: "24.99",
          savings: "60",
          thumb: "",
        },
      ]),
    );
  };
  try {
    const result = await fetchDeals("Hades", {
      query: "Hades",
      storeIds: ["7", "1"],
      maxPrice: 15,
      steamOnly: true,
      onSale: true,
      sort: "savings",
      page: 2,
      pageSize: 24,
    });
    const params = new URL(requested).searchParams;
    expect(Object.fromEntries(params)).toEqual({
      pageSize: "24",
      pageNumber: "2",
      title: "Hades",
      storeID: "1,7",
      upperPrice: "15",
      steamworks: "1",
      onSale: "1",
      sortBy: "Savings",
    });
    expect(result[0]).toMatchObject({
      storeId: "1",
      steamRedeemable: true,
      url: "https://www.cheapshark.com/redirect?dealID=filtered",
      cheapestPrice: 9.99,
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("catalog fallbacks honor store and price filters without extra requests", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response("Rate limited", { status: 429 }));
  };
  try {
    const result = await fetchDeals("", {
      query: "",
      storeIds: ["25"],
      maxPrice: 10,
      onSale: true,
      pageSize: 24,
    });
    expect(result).toMatchObject([
      {
        title: "Hogwarts Legacy",
        storeId: "25",
        cheapestPrice: 5.99,
        source: "catalog",
        steamRedeemable: false,
      },
    ]);
    expect(calls).toBe(1);
    expect(
      await fetchDeals("", { query: "", storeIds: ["25"], steamOnly: true }),
    ).toEqual([]);
    expect(await fetchDeals("", { query: "", page: 1 })).toEqual([]);
  } finally {
    globalThis.fetch = original;
  }
});

test("a successful empty filtered search does not substitute unrelated catalog offers", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(Response.json([]));
  try {
    expect(
      await fetchDeals("Hades", {
        query: "Hades",
        storeIds: ["25"],
        maxPrice: 0,
      }),
    ).toEqual([]);
  } finally {
    globalThis.fetch = original;
  }
});
