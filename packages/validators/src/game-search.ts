import { z } from "zod/v4";

const steamAppId = z.number().int().positive().max(2147483647);

/** Input for the public "add any game" title search. */
export const GameSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
});

export const GameSearchResultSchema = z.object({
  steamAppId,
  title: z.string().min(1),
  image: z.string(),
  /** Current Steam price in USD; null when unknown, 0 when free. */
  price: z.number().nonnegative().nullable(),
});
export type GameSearchResult = z.infer<typeof GameSearchResultSchema>;

/** Input for the news feed aggregated from a user's own games. */
export const CollectionFeedInputSchema = z.object({
  steamAppIds: z.array(steamAppId).max(24),
  limit: z.number().int().min(1).max(80).default(60),
});

const storeSearchItem = z.object({
  type: z.string().optional(),
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  tiny_image: z.string().optional(),
  price: z
    .object({ final: z.number().optional(), currency: z.string().optional() })
    .optional(),
});

/**
 * Parses a Steam `storesearch` response into apps the user can add.
 * Non-app rows (bundles/subs), malformed rows, and duplicates are skipped.
 * A missing or non-USD price is `null`; Steam omits the price for free titles,
 * so `null` means "unknown or free", never a confirmed $0.
 */
// Steam search also returns soundtracks, demos and tools as "apps"; adding
// them would pollute the library, spending and news.
const nonGamePattern =
  /\b(soundtrack|ost|artbook|art book|demo|playtest|dedicated server|sdk|benchmark|wallpaper engine)\b/i;

export function isNonGameTitle(title: string) {
  return nonGamePattern.test(title);
}

export function parseSteamStoreSearch(payload: unknown): GameSearchResult[] {
  const items =
    payload && typeof payload === "object" && "items" in payload
      ? (payload as { items: unknown }).items
      : [];
  if (!Array.isArray(items)) return [];
  const seen = new Set<number>();
  return items.flatMap((raw) => {
    const parsed = storeSearchItem.safeParse(raw);
    if (!parsed.success) return [];
    const item = parsed.data;
    const id = Number(item.id);
    if (item.type && item.type !== "app") return [];
    if (!steamAppId.safeParse(id).success || seen.has(id)) return [];
    const title = item.name.trim();
    if (!title || isNonGameTitle(title)) return [];
    seen.add(id);
    const cents = item.price?.final;
    const usd = !item.price?.currency || item.price.currency === "USD";
    return [
      {
        steamAppId: id,
        title,
        image: item.tiny_image ?? "",
        price: cents != null && usd ? Math.round(cents) / 100 : null,
      },
    ];
  });
}
