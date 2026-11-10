import { z } from "zod/v4";

// Match PostgreSQL integer IDs and numeric(10, 2) prices.
const SteamAppIdSchema = z.number().int().positive().max(2147483647);
const PriceSchema = z.number().min(0).max(99999999.99).multipleOf(0.01);

/** Where an owned game was bought: the seller, not the launcher. */
export const PurchaseStoreSchema = z.enum([
  "steam",
  "gog",
  "epic",
  "humble",
  "fanatical",
  "greenmangaming",
  "gamebillet",
  "gamesplanet",
  "wingamestore",
  "indiegala",
  "gamersgate",
  "ubisoft",
  "other",
]);
export type PurchaseStore = z.infer<typeof PurchaseStoreSchema>;
export const purchaseStoreNames: Readonly<Record<PurchaseStore, string>> = {
  steam: "Steam",
  gog: "GOG",
  epic: "Epic Games Store",
  humble: "Humble",
  fanatical: "Fanatical",
  greenmangaming: "Green Man Gaming",
  gamebillet: "GameBillet",
  gamesplanet: "Gamesplanet",
  wingamestore: "WinGameStore",
  indiegala: "IndieGala",
  gamersgate: "GamersGate",
  ubisoft: "Ubisoft Store",
  other: "Another store",
};

/** Which launcher a game runs in. Unset means Steam, the default for AppIDs. */
export const PlatformSchema = z.enum(["steam", "gog", "epic", "ubisoft", "other"]);
export type Platform = z.infer<typeof PlatformSchema>;
export const platformNames: Readonly<Record<Platform, string>> = {
  steam: "Steam",
  gog: "GOG Galaxy",
  epic: "Epic Games Launcher",
  ubisoft: "Ubisoft Connect",
  other: "Another launcher",
};

const cheapSharkStores: Readonly<Record<string, PurchaseStore>> = {
  "1": "steam",
  "2": "gamersgate",
  "3": "greenmangaming",
  "7": "gog",
  "11": "humble",
  "13": "ubisoft",
  "15": "fanatical",
  "21": "wingamestore",
  "23": "gamebillet",
  "25": "epic",
  "27": "gamesplanet",
  "30": "indiegala",
};

/** Maps a CheapShark store ID to the seller recorded on a purchase. */
export function purchaseStoreFromDeal(storeId: string | null | undefined) {
  return (storeId && cheapSharkStores[storeId]) || "other";
}

/**
 * The launcher a purchase most likely runs in: GOG, Epic and Ubisoft sell for
 * their own launchers; key sellers and Steam itself activate on Steam.
 */
export function defaultPlatform(store: PurchaseStore | null | undefined): Platform {
  return store === "gog" || store === "epic" || store === "ubisoft"
    ? store
    : store === "other"
      ? "other"
      : "steam";
}

/** Resolved launcher for an item: explicit choice, else inferred from store. */
export function itemPlatform(item: {
  platform?: Platform | null;
  purchaseStore?: PurchaseStore | null;
}): Platform {
  return item.platform ?? defaultPlatform(item.purchaseStore);
}

export const UpsertBacklogItemSchema = z.object({
  steamAppId: SteamAppIdSchema,
  title: z.string().trim().min(1).max(500),
  isOwned: z.boolean().optional(),
  amountPaid: PriceSchema.nullable().optional(),
  targetPrice: PriceSchema.nullable().optional(),
  notifyPatches: z.boolean().optional(),
  notifyEvents: z.boolean().optional(),
  completionStatus: z.enum(["backlog", "playing", "completed"]).optional(),
  purchaseStore: PurchaseStoreSchema.nullable().optional(),
  platform: PlatformSchema.nullable().optional(),
});

export const SearchDealsInputSchema = z
  .object({
    query: z.string().trim().max(200).optional().default(""),
    storeIds: z
      .array(
        z.enum([
          "1",
          "2",
          "3",
          "7",
          "11",
          "13",
          "15",
          "21",
          "23",
          "25",
          "27",
          "28",
          "30",
          "35",
        ]),
      )
      .max(14)
      .optional(),
    maxPrice: z.number().min(0).max(1000).optional(),
    steamOnly: z.boolean().optional(),
    onSale: z.boolean().optional(),
    sort: z.enum(["deals", "price", "savings", "title", "recent"]).optional(),
    page: z.number().int().min(0).max(100).optional(),
    pageSize: z.number().int().min(1).max(60).optional(),
  })
  .optional();

export const DealItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  cheapestPrice: z.coerce.number().nonnegative(),
  normalPrice: z.coerce.number().nonnegative(),
  savingsPercent: z.coerce.number().nonnegative(),
  steamAppId: z.number().nullable().optional(),
  thumb: z.string(),
  source: z.enum(["cheapshark", "steam", "catalog"]).optional(),
  storeId: z.string().optional(),
  url: z.url().optional(),
  steamRedeemable: z.boolean().optional(),
});

export const storeNames: Readonly<Record<string, string>> = {
  "1": "Steam",
  "2": "GamersGate",
  "3": "Green Man Gaming",
  "7": "GOG",
  "11": "Humble Store",
  "13": "Ubisoft Store",
  "15": "Fanatical",
  "21": "WinGameStore",
  "23": "GameBillet",
  "25": "Epic Games Store",
  "27": "Gamesplanet",
  "28": "Gamesload",
  "30": "IndieGala",
  "35": "DreamGame",
};

export const SteamFeedInputSchema = z
  .object({
    steamAppId: SteamAppIdSchema.optional(),
    category: z.enum(["patch_note", "event"]).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .prefault({});

export const BacklogExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  items: z.array(
    z.object({
      steamAppId: SteamAppIdSchema,
      title: z.string().trim().min(1).max(500),
      isOwned: z.boolean(),
      amountPaid: PriceSchema.optional(),
      targetPrice: PriceSchema.optional(),
      completionStatus: z.enum(["backlog", "playing", "completed"]).optional(),
      notifyPatches: z.boolean().optional(),
      notifyEvents: z.boolean().optional(),
      purchaseStore: PurchaseStoreSchema.optional(),
      platform: PlatformSchema.optional(),
    }),
  ),
});

export function cleanSteamText(text: string): string {
  const entities: Record<string, string> = {
    quot: '"',
    amp: "&",
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
  };
  return text
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (!code.startsWith("#")) return entities[code.toLowerCase()] ?? entity;
      const point = code.toLowerCase().startsWith("#x")
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/\[img\][\s\S]*?\[\/img\]/gi, "")
    .replace(/(?:https?:\/\/|www\.)[^\s<>\]]+/gi, "")
    // Block structure becomes line breaks; list items become bullets.
    .replace(/\[\*\]|<li\b[^>]*>/gi, "\n\u2022 ")
    .replace(
      /\[\/?(?:h[1-6]|p|list|olist|hr|table|tr|td|th|quote|code|previewyoutube)\b[^\]]*\]|<\/?(?:h[1-6]|p|div|ul|ol|br|hr|table|tr|blockquote)\b[^>]*>/gi,
      "\n",
    )
    // Inline markup is removed without leaving gaps before punctuation.
    .replace(/\[\/?[a-z*][^\]]*\]/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[*=_~-]{3,}/g, " ")
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && line !== "\u2022")
    .reduce((text, line) => {
      const bullet = line.startsWith("\u2022 ");
      const content = bullet ? line.slice(2).trim() : line;
      if (!text) return content;
      const previousBullet = text.endsWith("\u0000");
      const base = text.replace(/\u0000$/, "");
      // A short line without punctuation is a heading for what follows.
      const lastLine = base.split(/[.!?…:·] /).pop() ?? "";
      const words = lastLine.split(" ");
      const heading =
        !previousBullet &&
        words.length <= 4 &&
        words.every((word) => !/^\p{Ll}/u.test(word)) &&
        !/[.!?…:,;–—-]$/.test(base);
      // Consecutive headings ("Fixes" then "Crash Fixes") keep only the
      // more specific one rather than chaining "Fixes: Crash Fixes:".
      const contentWords = content.split(" ");
      const contentIsHeading =
        !bullet &&
        contentWords.length <= 4 &&
        contentWords.every((word) => !/^\p{Ll}/u.test(word)) &&
        !/[.!?…:,;]$/.test(content);
      if (heading && contentIsHeading)
        return `${base.slice(0, base.length - lastLine.length)}${content}`;
      const joiner = bullet
        ? previousBullet
          ? " · "
          : /[.!?…:]$/.test(base)
            ? " "
            : ": "
        : /[.!?…:,;–—-]$/.test(base)
          ? " "
          : heading
            ? ": "
            : ". ";
      return `${base}${joiner}${content}${bullet ? "\u0000" : ""}`;
    }, "")
    .replace(/\u0000/g, "")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([.!?])\./g, "$1")
    .trim();
}

/**
 * Shortens text to at most `max` characters, cutting at the last word boundary
 * and adding an ellipsis. A single unbroken word longer than `max` is hard-cut.
 */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,;:.!?–—-]+$/, "")}…`;
}

const patchPattern =
  /\b(patch\w*|hotfix\w*|changelog\w*|bug\s*fix\w*|fix(es|ed)?|update\w*|(v|version\s*)\d+(\.\d+)+|balance\s+changes)\b/i;
const launchPattern =
  /\b(now available|out now|available now|launch(es|ed)?|release[sd]?|early access)\b/i;
const eventPattern =
  /\b(event\w*|double\s*xp|free\s*weekend|season\w*|tournament\w*|drops|raid\w*|festival\w*|limited[\s-]*time|anniversary|dlc|expansion\w*|livestream\w*|stream\w*|showcase)\b/i;

/**
 * Classifies a Steam news post from its tags, feed label and title. The body
 * is ignored: announcements routinely mention "update" or "season" in passing.
 * Launch posts ("v1.0 is now available") are events, not patch notes, unless
 * the title also names a patch or hotfix.
 */
export function classifyAndCleanSteamNews(item: {
  title: string;
  contents: string;
  tags?: string[];
  feedlabel?: string;
}): { category: "patch_note" | "event" | "general"; cleanSummary: string } {
  const cleanSummary = truncateAtWord(cleanSteamText(item.contents), 280);
  const tags = (item.tags ?? []).map((tag) => tag.toLowerCase());
  const title = cleanSteamText(item.title);
  const label = item.feedlabel ?? "";

  const taggedPatch = tags.some((tag) => tag.includes("patchnote"));
  const titledPatch =
    patchPattern.test(title) &&
    !(launchPattern.test(title) && !/\b(patch|hotfix|update)\w*\b/i.test(title));
  if (
    taggedPatch ||
    titledPatch ||
    /\b(patch|version|update|changelog)\w*\b/i.test(label)
  )
    return { category: "patch_note", cleanSummary };

  if (
    eventPattern.test(title) ||
    launchPattern.test(title) ||
    tags.some((tag) => eventPattern.test(tag)) ||
    eventPattern.test(label)
  )
    return { category: "event", cleanSummary };

  return { category: "general", cleanSummary };
}

const promoPattern =
  /\b(keycaps?|figures?|figuarts|replicas?|collectibles?|statuettes?|mousepads?|posters?|merch\w*|plush\w*|statues?|apparel|t-?shirts?|hoodies?|soundtracks?|art\s*books?|collector'?s edition|pre-?orders?|bundles?|on sale|sale (ends|starts|is live)|\d+%\s*off|discount\w*|wallpapers?)\b/i;

/** Merchandise and storefront promotions, hidden from the patch-note digest. */
export function isPromotionalNews(item: { title: string; tags?: string[] }) {
  return (
    promoPattern.test(cleanSteamText(item.title)) ||
    (item.tags ?? []).some((tag) => /^(sale|promo|merch)/i.test(tag))
  );
}

export function evaluateDealAlert(params: {
  isOwned: boolean;
  currentPrice: number;
  targetPrice: number | null;
  historicalLow: number;
}): { shouldAlert: boolean; reason: "TARGET_MET" | "ALL_TIME_LOW" | null } {
  if (params.isOwned) return { shouldAlert: false, reason: null };
  if (
    params.targetPrice !== null &&
    params.currentPrice <= params.targetPrice
  ) {
    return { shouldAlert: true, reason: "TARGET_MET" };
  }
  if (params.currentPrice > 0 && params.currentPrice <= params.historicalLow) {
    return { shouldAlert: true, reason: "ALL_TIME_LOW" };
  }
  return { shouldAlert: false, reason: null };
}

const sequelMarker = /^\s*[:\-–—]?\s*(II|III|IV|V|VI|2|3|4|5|6)\b/;

/**
 * True when a post is really about a sequel of the followed game, e.g.
 * "Hades II v1.0 is now available" in the Hades feed. Steam often cross-posts
 * sequel news to the original game's page.
 */
export function isAboutSequel(postTitle: string, gameTitle: string) {
  const index = postTitle.toLowerCase().indexOf(gameTitle.toLowerCase());
  if (index < 0) return false;
  const rest = postTitle.slice(index + gameTitle.length);
  return sequelMarker.test(rest) && !sequelMarker.test(gameTitle.slice(-4));
}
