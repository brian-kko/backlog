import { describe, expect, it } from "vitest";

import {
  BacklogExportSchema,
  classifyAndCleanSteamNews,
  cleanSteamText,
  DealItemSchema,
  evaluateDealAlert,
  SearchDealsInputSchema,
  isAboutSequel,
  isPromotionalNews,
  SteamFeedInputSchema,
  truncateAtWord,
  UpsertBacklogItemSchema,
} from "../backlog-parser";

describe("Backlog - Steam Feed & Deal Engine", () => {
  it("strips Steam BBCode tags and classifies hotfixes as patch_note", () => {
    const res = classifyAndCleanSteamNews({
      title: "Hotfix v1.04 - Balance Changes",
      contents:
        "[h1]Notes[/h1] [*] Fixed crash on startup [url=https://steam.com]Details[/url]",
    });
    expect(res.category).toBe("patch_note");
    expect(res.cleanSummary).toBe("Notes: Fixed crash on startup Details");
  });

  it("suppresses deal alerts for games already owned in the user's backlog", () => {
    const alert = evaluateDealAlert({
      isOwned: true,
      currentPrice: 9.99,
      targetPrice: 15.0,
      historicalLow: 9.99,
    });
    expect(alert.shouldAlert).toBe(false);
  });

  it("validates exported/imported Backlog JSON backups against corruption", () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: [
        {
          steamAppId: 1091500,
          title: "Cyberpunk 2077",
          isOwned: false,
          targetPrice: 24.99,
        },
      ],
    };
    expect(BacklogExportSchema.safeParse(payload).success).toBe(true);
  });
});

describe("UpsertBacklogItemSchema", () => {
  const item = { steamAppId: 1091500, title: " Cyberpunk 2077 " };

  it("trims titles and leaves omitted update fields unset", () => {
    expect(UpsertBacklogItemSchema.parse(item)).toEqual({
      steamAppId: 1091500,
      title: "Cyberpunk 2077",
    });
  });

  it("accepts ownership, notification settings, and free or paid prices", () => {
    const input = {
      ...item,
      title: "Cyberpunk 2077",
      isOwned: true,
      amountPaid: 0,
      targetPrice: 24.99,
      notifyPatches: false,
      notifyEvents: true,
    };
    expect(UpsertBacklogItemSchema.parse(input)).toEqual(input);
  });

  it("allows prices to be explicitly cleared", () => {
    expect(
      UpsertBacklogItemSchema.parse({
        ...item,
        amountPaid: null,
        targetPrice: null,
      }),
    ).toMatchObject({ amountPaid: null, targetPrice: null });
  });

  it.each([0, -1, 1.5, 2147483648, "1091500"])(
    "rejects invalid Steam ID %s",
    (steamAppId) => {
      expect(
        UpsertBacklogItemSchema.safeParse({ ...item, steamAppId }).success,
      ).toBe(false);
    },
  );

  it.each(["", "  ", "a".repeat(501)])("rejects invalid titles", (title) => {
    expect(UpsertBacklogItemSchema.safeParse({ ...item, title }).success).toBe(
      false,
    );
  });

  it.each([-0.01, 1.001, 100000000, Infinity, NaN, "9.99"])(
    "rejects invalid price %s",
    (price) => {
      for (const field of ["amountPaid", "targetPrice"]) {
        expect(
          UpsertBacklogItemSchema.safeParse({ ...item, [field]: price })
            .success,
        ).toBe(false);
      }
    },
  );

  it("accepts the maximum database price and strips client-supplied user IDs", () => {
    const parsed = UpsertBacklogItemSchema.parse({
      ...item,
      amountPaid: 99999999.99,
      userId: "other-user",
    });
    expect(parsed.amountPaid).toBe(99999999.99);
    expect(parsed).not.toHaveProperty("userId");
  });

  it.each(["isOwned", "notifyPatches", "notifyEvents"])(
    "requires a boolean for %s",
    (field) => {
      expect(
        UpsertBacklogItemSchema.safeParse({ ...item, [field]: "false" })
          .success,
      ).toBe(false);
    },
  );
});

describe("SearchDealsInputSchema", () => {
  it("accepts combined store, price, platform, sort and page filters", () => {
    expect(
      SearchDealsInputSchema.parse({
        query: " Hades ",
        storeIds: ["1", "7"],
        maxPrice: 15,
        steamOnly: true,
        onSale: true,
        sort: "savings",
        page: 2,
        pageSize: 24,
      }),
    ).toEqual({
      query: "Hades",
      storeIds: ["1", "7"],
      maxPrice: 15,
      steamOnly: true,
      onSale: true,
      sort: "savings",
      page: 2,
      pageSize: 24,
    });
  });
  it.each([
    { storeIds: ["999"] },
    { maxPrice: -1 },
    { maxPrice: Infinity },
    { steamOnly: "yes" },
    { onSale: "yes" },
    { sort: "invalid" },
    { page: -1 },
    { page: 1.5 },
    { pageSize: 0 },
    { pageSize: 61 },
  ])("rejects invalid deal filters %j", (input) => {
    expect(SearchDealsInputSchema.safeParse(input).success).toBe(false);
  });
  it("accepts optional, empty, and blank queries for featured deals", () => {
    expect(SearchDealsInputSchema.parse(undefined)).toBeUndefined();
    expect(SearchDealsInputSchema.parse({})).toEqual({ query: "" });
    expect(SearchDealsInputSchema.parse({ query: "  " })).toEqual({
      query: "",
    });
    expect(SearchDealsInputSchema.parse({ query: "" })).toEqual({ query: "" });
  });

  it("trims searches and rejects invalid query types and oversized searches", () => {
    expect(SearchDealsInputSchema.parse({ query: " Portal " })).toEqual({
      query: "Portal",
    });
    for (const query of ["a".repeat(201), 123, null]) {
      expect(SearchDealsInputSchema.safeParse({ query }).success).toBe(false);
    }
  });
});

describe("DealItemSchema", () => {
  it.each([null, undefined, 1091500])(
    "accepts Steam ID %s and string prices",
    (steamAppId) => {
      expect(
        DealItemSchema.parse({
          id: "deal",
          title: "Game",
          steamAppId,
          thumb: "",
          cheapestPrice: "29.99",
          normalPrice: "59.99",
          savingsPercent: "50.01",
        }),
      ).toMatchObject({
        steamAppId,
        cheapestPrice: 29.99,
        normalPrice: 59.99,
        savingsPercent: 50.01,
      });
    },
  );
  it("rejects invalid numeric prices", () => {
    expect(
      DealItemSchema.safeParse({
        id: "deal",
        title: "Game",
        thumb: "",
        cheapestPrice: "oops",
        normalPrice: "59.99",
        savingsPercent: "50",
      }).success,
    ).toBe(false);
  });
});

describe("Steam text cleanup", () => {
  it("decodes entities and removes raw and BBCode URLs before classification", () => {
    const contents =
      "&quot;Hello&quot; &amp; it&#39;s &#x66;un&nbsp; [url=https://example.com]Read more[/url] https://spam.test/update www.spam.test/event";
    expect(cleanSteamText(contents)).toBe('"Hello" & it\'s fun Read more');
    expect(classifyAndCleanSteamNews({ title: "A letter", contents })).toEqual({
      cleanSummary: '"Hello" & it\'s fun Read more',
      category: "general",
    });
  });
  it("strips entity-encoded HTML and handles invalid code points", () => {
    expect(cleanSteamText("&lt;b&gt;Welcome&lt;/b&gt; &#99999999;")).toBe(
      "Welcome",
    );
  });
});

describe("SteamFeedInputSchema", () => {
  it("allows a feed request without filters", () => {
    expect(SteamFeedInputSchema.parse(undefined)).toEqual({ limit: 50 });
  });

  it.each(["patch_note", "event"])(
    "accepts the %s category and a game filter",
    (category) => {
      expect(
        SteamFeedInputSchema.parse({ category, steamAppId: 570, limit: 10 }),
      ).toEqual({ category, steamAppId: 570, limit: 10 });
    },
  );

  it("rejects unsupported categories and invalid limits or IDs", () => {
    for (const input of [
      { category: "deals" },
      { limit: 0 },
      { limit: 101 },
      { steamAppId: -1 },
    ]) {
      expect(SteamFeedInputSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe("Steam news classification from tags, labels and titles", () => {
  it.each([
    "Patch 1.2",
    "Hotfix for crashes",
    "Update 2.5 is out now!",
    "Changelog",
    "Bug fixes",
    "Fixed matchmaking",
    "Balance changes",
    "v2.31",
    "Version 1.0.4",
  ])("recognizes the patch title %s", (title) => {
    expect(
      classifyAndCleanSteamNews({ title, contents: "Read more" }).category,
    ).toBe("patch_note");
  });

  it("ignores patch keywords that only appear in the body", () => {
    expect(
      classifyAndCleanSteamNews({
        title: "From the developers",
        contents: "[b]update[/b] on our plans, bug reports and the next version.",
      }).category,
    ).toBe("general");
  });

  it("treats launches as events unless the title names a patch", () => {
    expect(
      classifyAndCleanSteamNews({
        title: "Hades II v1.0 Is Now Available!",
        contents: "",
      }).category,
    ).toBe("event");
    expect(
      classifyAndCleanSteamNews({
        title: "Update 1.1 is out now",
        contents: "",
      }).category,
    ).toBe("patch_note");
  });

  it("does not treat server maintenance as patch notes", () => {
    expect(
      classifyAndCleanSteamNews({
        title: "Galactic Network Maintenance",
        contents: "Servers will be down while we update.",
      }).category,
    ).toBe("general");
  });

  it.each([
    "Community event",
    "Double XP weekend",
    "Free weekend",
    "Season 4 begins",
    "Tournament finals",
    "Twitch drops",
    "Raid night",
    "Winter festival",
    "Limited-time mode",
    "It's the Five-Year Anniversary!",
    "New DLC",
    "Expansion announced",
  ])("recognizes the event title %s", (title) => {
    expect(
      classifyAndCleanSteamNews({ title, contents: "Join us" }).category,
    ).toBe("event");
  });

  it("ignores event keywords that only appear in the body", () => {
    expect(
      classifyAndCleanSteamNews({
        title: "Join us",
        contents: "[h1]season[/h1] plans and an anniversary soon.",
      }).category,
    ).toBe("general");
  });

  it("uses tags and feed labels, with patch classification taking precedence", () => {
    expect(
      classifyAndCleanSteamNews({
        title: "Hello",
        contents: "",
        tags: ["patchnotes"],
      }).category,
    ).toBe("patch_note");
    expect(
      classifyAndCleanSteamNews({
        title: "Hello",
        contents: "",
        feedlabel: "Version notes",
      }).category,
    ).toBe("patch_note");
    expect(
      classifyAndCleanSteamNews({
        title: "Hello",
        contents: "",
        tags: ["anniversary"],
      }).category,
    ).toBe("event");
    expect(
      classifyAndCleanSteamNews({
        title: "Hello",
        contents: "",
        feedlabel: "DLC",
      }).category,
    ).toBe("event");
    expect(
      classifyAndCleanSteamNews({
        title: "Festival hotfix",
        contents: "",
      }).category,
    ).toBe("patch_note");
  });

  it("flags merchandise and storefront promotions", () => {
    for (const title of [
      "Alexander, Warrior Jar Artisan Keycap has arrived!",
      "STARSCOURGE RADAHN FIGUARTS available for pre-order",
      "Soundtrack now on vinyl",
      "Save 50% off this weekend",
      "New Elden Ring Mini Replicas Arrive: Malenia, Messmer & Wyld",
    ])
      expect(isPromotionalNews({ title })).toBe(true);
    expect(isPromotionalNews({ title: "Patch 1.2" })).toBe(false);
    expect(isPromotionalNews({ title: "News", tags: ["sale"] })).toBe(true);
  });

  it("separates list items instead of running words together", () => {
    expect(
      cleanSteamText(
        "[h2]Fixes[/h2][list][*]Crash fixes[*]Fixed audio[/list]*** INCOMING ***",
      ),
    ).toBe("Fixes: Crash fixes · Fixed audio. INCOMING");
  });

  it("joins comma-ended lines and short headings naturally", () => {
    expect(
      cleanSteamText(
        "Attention Helldivers,\nCaptain Morris here.\n🔧 Fixes\nFixed a crash when joining.",
      ),
    ).toBe(
      "Attention Helldivers, Captain Morris here. 🔧 Fixes: Fixed a crash when joining.",
    );
  });

  it("keeps only the more specific of two consecutive headings", () => {
    expect(
      cleanSteamText(
        "[h2]🔧 Fixes[/h2][h3]Crash Fixes[/h3][list][*]Fixed a crash that would occur on exit[/list]",
      ),
    ).toBe("Crash Fixes: Fixed a crash that would occur on exit");
    expect(
      cleanSteamText(
        "Stratagems\nAMW-20 APEX\nProblem we want to solve:\nDemolition strength was too low.",
      ),
    ).toBe("AMW-20 APEX: Problem we want to solve: Demolition strength was too low.");
  });

  it("recognizes sequel posts cross-posted to the original game", () => {
    expect(isAboutSequel("Hades II v1.0 Is Now Available!", "Hades")).toBe(
      true,
    );
    expect(isAboutSequel("Hades: It's the Five-Year Anniversary!", "Hades")).toBe(
      false,
    );
    expect(isAboutSequel("Baldur's Gate 3 Patch 8", "Baldur's Gate 3")).toBe(
      false,
    );
    expect(isAboutSequel("Patch notes", "Hades")).toBe(false);
  });

  it("keeps punctuation attached when inline markup is removed", () => {
    expect(
      cleanSteamText(
        "Thank you for playing [b]ELDEN RING[/b]. This patch adds the [i]Tarnished Pack DLC[/i], scheduled for [url=https://x.test]Steam Deck[/url], plus fixes!",
      ),
    ).toBe(
      "Thank you for playing ELDEN RING. This patch adds the Tarnished Pack DLC, scheduled for Steam Deck, plus fixes!",
    );
  });

  it("reads realistic patch bodies as sentences and bullet points", () => {
    expect(
      cleanSteamText(
        "[h2]Problem we want to solve:[/h2][list][*]Demolition strength was too low[*]Terminals crashed[/list][p]Thanks, Helldivers![/p]",
      ),
    ).toBe(
      "Problem we want to solve: Demolition strength was too low · Terminals crashed. Thanks, Helldivers!",
    );
    expect(cleanSteamText("Line one\nLine two\n\nLine three.")).toBe(
      "Line one. Line two. Line three.",
    );
  });

  it("preserves general announcements and strips BBCode, HTML and embedded images", () => {
    const result = classifyAndCleanSteamNews({
      title: "A letter",
      contents:
        "[h1]Hello[/h1] [b]world[/b] [url=https://example.com?a=1&b=2]Read more[/url] [img]https://image.test/pic.jpg[/img] <p>Welcome</p>",
    });
    expect(result).toEqual({
      category: "general",
      cleanSummary: "Hello: world Read more. Welcome",
    });
    expect(
      classifyAndCleanSteamNews({
        title: "A letter",
        contents: "a".repeat(400),
      }).cleanSummary,
    ).toHaveLength(280);
  });

  it("truncates summaries at a word boundary with an ellipsis", () => {
    expect(truncateAtWord("short text", 280)).toBe("short text");
    const long = "word ".repeat(100).trim();
    const result = truncateAtWord(long, 280);
    expect(result.length).toBeLessThanOrEqual(280);
    expect(result.endsWith("word…")).toBe(true);
    expect(truncateAtWord("Hello there, friend", 15)).toBe("Hello there…");
    expect(truncateAtWord("x".repeat(20), 10)).toBe("xxxxxxxxx…");
  });
});

describe("Wishlist decisions and status backups", () => {
  it.each([
    [10, 15, 5, "TARGET_MET"],
    [5, null, 5, "ALL_TIME_LOW"],
    [20, 15, 5, null],
    [0, null, 0, null],
  ] as const)(
    "evaluates price %s against target %s and historical low %s",
    (currentPrice, targetPrice, historicalLow, reason) => {
      expect(
        evaluateDealAlert({
          isOwned: false,
          currentPrice,
          targetPrice,
          historicalLow,
        }),
      ).toEqual({ shouldAlert: reason !== null, reason });
    },
  );

  it("round-trips completion status and notification preferences", () => {
    const item = {
      steamAppId: 730,
      title: "Counter-Strike 2",
      isOwned: true,
      completionStatus: "playing",
      notifyPatches: false,
      notifyEvents: true,
    };
    expect(UpsertBacklogItemSchema.parse(item)).toEqual(item);
    expect(
      BacklogExportSchema.parse({
        version: 1,
        exportedAt: new Date().toISOString(),
        items: [item],
      }).items,
    ).toEqual([item]);
    expect(
      UpsertBacklogItemSchema.safeParse({
        ...item,
        completionStatus: "unknown",
      }).success,
    ).toBe(false);
  });
});
