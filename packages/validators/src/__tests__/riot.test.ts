import { describe, expect, it } from "vitest";

import { defaultPlatform, itemPlatform } from "../backlog-parser";
import {
  isRiotGame,
  parseRiotNews,
  RIOT_ID_BASE,
  riotGame,
  riotGames,
  searchRiotGames,
} from "../riot";

const league = riotGames[0];
if (!league) throw new Error("League of Legends must be in the catalog");

const page = (items: unknown[]) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        page: {
          blades: [{ type: "header" }, { type: "articleCardGrid", items }],
        },
      },
    },
  })}</script></html>`;

const card = (overrides: Record<string, unknown> = {}) => ({
  title: "League of Legends Patch 26.23 Notes",
  publishedAt: "2026-11-17T19:00:00.000Z",
  action: {
    type: "weblink",
    payload: {
      url: "/en-us/news/game-updates/league-of-legends-patch-26-23-notes",
    },
  },
  media: {
    url: "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/abc-1920x1092.jpg?accountingTag=LoL",
  },
  description: {
    type: "html",
    body: "<p>Winter map returns &amp; balance updates.</p>",
  },
  analytics: { contentId: "patch-26-23" },
  ...overrides,
});

describe("Riot catalog", () => {
  it("uses IDs far above Steam's and finds games by ID", () => {
    for (const game of riotGames) {
      expect(game.id).toBeGreaterThan(RIOT_ID_BASE);
      expect(game.id).toBeLessThanOrEqual(2147483647);
    }
    expect(riotGame(league.id)?.title).toBe("League of Legends");
    expect(isRiotGame(1091500)).toBe(false);
    expect(isRiotGame(undefined)).toBe(false);
  });

  it("matches titles and the short names people use", () => {
    expect(searchRiotGames("lol").map((game) => game.title)).toEqual([
      "League of Legends",
    ]);
    expect(searchRiotGames("val").map((game) => game.title)).toEqual([
      "VALORANT",
    ]);
    expect(searchRiotGames("TFT").map((game) => game.title)).toEqual([
      "Teamfight Tactics",
    ]);
    expect(searchRiotGames("teamfight")).toHaveLength(1);
    expect(searchRiotGames("riot")).toHaveLength(3);
    expect(searchRiotGames("l")).toEqual([]);
    expect(searchRiotGames("hades")).toEqual([]);
  });

  it("defaults Riot games to the Riot Client", () => {
    expect(defaultPlatform(undefined, league.id)).toBe("riot");
    expect(defaultPlatform("steam", league.id)).toBe("riot");
    expect(defaultPlatform(undefined, 1091500)).toBe("steam");
  });

  it.each(riotGames)("$title always resolves to the Riot Client", ({ id }) => {
    expect(itemPlatform({ steamAppId: id })).toBe("riot");
    expect(
      itemPlatform({
        steamAppId: id,
        purchaseStore: "steam",
        platform: "steam",
      }),
    ).toBe("riot");
    expect(itemPlatform({ steamAppId: id, platform: "other" })).toBe("riot");
  });
});

describe("parseRiotNews", () => {
  it("reads patch notes with absolute links, plain-text summaries and art", () => {
    const [item] = parseRiotNews(page([card()]), league) ?? [];
    expect(item).toEqual({
      id: "patch-26-23",
      title: "League of Legends Patch 26.23 Notes",
      url: "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-23-notes",
      publishedAt: new Date("2026-11-17T19:00:00.000Z"),
      summary: "Winter map returns & balance updates.",
      image:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/abc-1920x1092.jpg?accountingTag=LoL",
      category: "patch_note",
    });
  });

  it("treats videos and non-patch posts as news, newest first", () => {
    const items =
      parseRiotNews(
        page([
          card({
            title: "TFT Patch 18.7 Rundown",
            publishedAt: "2026-11-10T00:00:00.000Z",
            action: {
              type: "youtube_video",
              payload: { url: "https://www.youtube.com/watch?v=abc" },
            },
            analytics: { contentId: "rundown" },
          }),
          card({
            title: "Worlds 2026 Pick'em",
            publishedAt: "2026-11-12T00:00:00.000Z",
            action: {
              type: "weblink",
              payload: { url: "/en-us/news/esports/pickem" },
            },
            analytics: { contentId: "pickem" },
          }),
          card(),
        ]),
        league,
      ) ?? [];
    expect(items.map((item) => [item.id, item.category])).toEqual([
      ["patch-26-23", "patch_note"],
      ["pickem", "event"],
      ["rundown", "event"],
    ]);
  });

  it("drops links and images on hosts it doesn't trust, and duplicates", () => {
    const items =
      parseRiotNews(
        page([
          card({
            action: {
              type: "weblink",
              payload: { url: "https://evil.example/patch" },
            },
          }),
          card({ media: { url: "https://evil.example/a.jpg" } }),
          card({ analytics: { contentId: "duplicate" } }),
          card({ publishedAt: "not a date" }),
        ]),
        league,
      ) ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]?.image).toBeNull();
  });

  it("returns null when the page no longer has Riot's page data", () => {
    expect(parseRiotNews("<html>Maintenance</html>", league)).toBeNull();
    expect(
      parseRiotNews(
        '<script id="__NEXT_DATA__" type="application/json">{oops</script>',
        league,
      ),
    ).toBeNull();
    expect(parseRiotNews(page([]), league)).toEqual([]);
  });
});
