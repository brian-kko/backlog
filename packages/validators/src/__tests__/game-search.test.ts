import { describe, expect, it } from "vitest";

import {
  CollectionFeedInputSchema,
  GameSearchInputSchema,
  GameSearchResultSchema,
  isNonGameTitle,
  parseSteamStoreSearch,
} from "../game-search";

describe("Game search & collection feed", () => {
  it("parses Steam store search apps with USD prices", () => {
    const results = parseSteamStoreSearch({
      total: 2,
      items: [
        {
          type: "app",
          name: "Hollow Knight",
          id: 367520,
          price: { currency: "USD", initial: 1499, final: 1499 },
          tiny_image: "https://example.com/hk.jpg",
        },
        { type: "app", name: "Dota 2", id: "570" },
      ],
    });
    expect(results).toEqual([
      {
        steamAppId: 367520,
        title: "Hollow Knight",
        image: "https://example.com/hk.jpg",
        price: 14.99,
      },
      { steamAppId: 570, title: "Dota 2", image: "", price: null },
    ]);
    for (const result of results)
      expect(GameSearchResultSchema.safeParse(result).success).toBe(true);
  });

  it("skips bundles, duplicates, invalid ids, blank titles, and malformed rows", () => {
    const results = parseSteamStoreSearch({
      items: [
        { type: "sub", name: "Bundle", id: 1 },
        { type: "app", name: "Game", id: 10 },
        { type: "app", name: "Game again", id: 10 },
        { type: "app", name: "Bad", id: -5 },
        { type: "app", name: "   ", id: 11 },
        { nope: true },
        "garbage",
      ],
    });
    expect(results.map((result) => result.steamAppId)).toEqual([10]);
  });

  it("drops soundtracks, demos and other non-game items", () => {
    const results = parseSteamStoreSearch({
      items: [
        { type: "app", name: "Hollow Knight", id: 367520 },
        { type: "app", name: "Hollow Knight Official Soundtrack", id: 1 },
        { type: "app", name: "Silksong – OST", id: 2 },
        { type: "app", name: "Game Demo", id: 3 },
        { type: "app", name: "Game Playtest", id: 4 },
      ],
    });
    expect(results.map((result) => result.title)).toEqual(["Hollow Knight"]);
    expect(isNonGameTitle("Demolition Derby")).toBe(false);
  });

  it("does not report non-USD prices as USD", () => {
    const [result] = parseSteamStoreSearch({
      items: [
        { name: "Game", id: 20, price: { currency: "EUR", final: 999 } },
      ],
    });
    expect(result?.price).toBeNull();
  });

  it("returns an empty list for missing or unexpected payloads", () => {
    expect(parseSteamStoreSearch(null)).toEqual([]);
    expect(parseSteamStoreSearch({ items: "x" })).toEqual([]);
    expect(parseSteamStoreSearch({})).toEqual([]);
  });

  it("requires a meaningful search query", () => {
    expect(GameSearchInputSchema.safeParse({ query: " a " }).success).toBe(
      false,
    );
    expect(GameSearchInputSchema.parse({ query: "  hades " }).query).toBe(
      "hades",
    );
    expect(
      GameSearchInputSchema.safeParse({ query: "x".repeat(101) }).success,
    ).toBe(false);
  });

  it("bounds the collection feed request", () => {
    expect(
      CollectionFeedInputSchema.parse({ steamAppIds: [570] }).limit,
    ).toBe(60);
    expect(
      CollectionFeedInputSchema.safeParse({
        steamAppIds: Array.from({ length: 25 }, (_, i) => i + 1),
      }).success,
    ).toBe(false);
    expect(
      CollectionFeedInputSchema.safeParse({ steamAppIds: [0] }).success,
    ).toBe(false);
  });
});

describe("Purchase store", () => {
  it("accepts known stores on backups and upserts and rejects others", async () => {
    const { BacklogExportSchema, UpsertBacklogItemSchema } = await import(
      "../backlog-parser"
    );
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: [
        { steamAppId: 1, title: "A", isOwned: true, purchaseStore: "gog" },
      ],
    };
    expect(BacklogExportSchema.safeParse(backup).success).toBe(true);
    expect(
      BacklogExportSchema.safeParse({
        ...backup,
        items: [{ ...backup.items[0], purchaseStore: "xbox" }],
      }).success,
    ).toBe(false);
    expect(
      UpsertBacklogItemSchema.parse({
        steamAppId: 1,
        title: "A",
        purchaseStore: null,
      }).purchaseStore,
    ).toBeNull();
  });
});

describe("Purchase store and platform", () => {
  it("maps deal stores to sellers and infers the launcher", async () => {
    const { purchaseStoreFromDeal, defaultPlatform, itemPlatform } =
      await import("../backlog-parser");
    expect(purchaseStoreFromDeal("23")).toBe("gamebillet");
    expect(purchaseStoreFromDeal("7")).toBe("gog");
    expect(purchaseStoreFromDeal("999")).toBe("other");
    expect(purchaseStoreFromDeal(undefined)).toBe("other");
    // Key sellers activate on Steam; first-party stores use their launcher.
    expect(defaultPlatform("gamebillet")).toBe("steam");
    expect(defaultPlatform("humble")).toBe("steam");
    expect(defaultPlatform(undefined)).toBe("steam");
    expect(defaultPlatform("gog")).toBe("gog");
    expect(defaultPlatform("other")).toBe("other");
    expect(itemPlatform({ purchaseStore: "gog", platform: "steam" })).toBe(
      "steam",
    );
    expect(itemPlatform({ purchaseStore: "epic" })).toBe("epic");
  });
});
