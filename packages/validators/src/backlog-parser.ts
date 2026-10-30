import { z } from "zod/v4";

// Match PostgreSQL integer IDs and numeric(10, 2) prices.
const SteamAppIdSchema = z.number().int().positive().max(2147483647);
const PriceSchema = z.number().min(0).max(99999999.99).multipleOf(0.01);

export const UpsertBacklogItemSchema = z.object({
  steamAppId: SteamAppIdSchema,
  title: z.string().trim().min(1).max(500),
  isOwned: z.boolean().optional(),
  amountPaid: PriceSchema.nullable().optional(),
  targetPrice: PriceSchema.nullable().optional(),
  notifyPatches: z.boolean().optional(),
  notifyEvents: z.boolean().optional(),
  completionStatus: z.enum(["backlog", "playing", "completed"]).optional(),
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
    .replace(/\[\/?[a-z*][^\]]*\]/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/(?:https?:\/\/|www\.)[^\s<>\]]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyAndCleanSteamNews(item: {
  title: string;
  contents: string;
  tags?: string[];
  feedlabel?: string;
}): { category: "patch_note" | "event" | "general"; cleanSummary: string } {
  const cleanSummary = cleanSteamText(item.contents).slice(0, 280);

  const text = [
    item.title,
    cleanSummary,
    ...(item.tags ?? []),
    item.feedlabel ?? "",
  ].join(" ");
  const isPatch =
    /\b(patch\w*|hotfix\w*|update\w*|changelog\w*|balance\w*|bug\w*|fix\w*|version\w*|notes|v\d+)\b/i.test(
      text,
    );

  if (isPatch) return { category: "patch_note", cleanSummary };

  const isEvent =
    /\b(event\w*|double\s*xp|free\s*weekend|season\w*|tournament\w*|drops|raid\w*|festival\w*|limited[\s-]*time|anniversary|dlc|expansion\w*)\b/i.test(
      text,
    );

  if (isEvent) return { category: "event", cleanSummary };

  return { category: "general", cleanSummary };
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
