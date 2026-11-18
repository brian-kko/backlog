import type { RiotGame, RiotNewsItem } from "@acme/validators";
import { digestNews, parseRiotNews, riotGame } from "@acme/validators";

/*
 * Riot has no public news API, so each game's news listing page is read once
 * per half hour and its embedded article cards are parsed. Failures are
 * reported as "unavailable", never as "no updates".
 */
const ttlMs = 30 * 60 * 1000;
const cache = new Map<
  number,
  { expiresAt: number; items: RiotNewsItem[] | null }
>();
const pending = new Map<number, Promise<RiotNewsItem[] | null>>();

async function loadNews(game: RiotGame): Promise<RiotNewsItem[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(game.newsUrl, {
      signal: controller.signal,
      // Riot's pages only live on Riot's own domains.
      redirect: "error",
      headers: { "User-Agent": "GemuzuApp/1.0" },
    });
    if (!response.ok) return null;
    return parseRiotNews(await response.text(), game);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** The game's news cards, newest first; null when Riot couldn't be read. */
export function fetchRiotNews(id: number): Promise<RiotNewsItem[] | null> {
  const game = riotGame(id);
  if (!game) return Promise.resolve(null);
  const cached = cache.get(id);
  if (cached && cached.expiresAt > Date.now())
    return Promise.resolve(cached.items);
  const inFlight = pending.get(id);
  if (inFlight) return inFlight;
  const request = loadNews(game)
    .then((items) => {
      // Failures are retried after a minute rather than held for half an hour.
      cache.set(id, {
        expiresAt: Date.now() + (items ? ttlMs : 60_000),
        items,
      });
      return items;
    })
    .finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}

/** Same shape as the Steam feed, so pages treat Riot games like any other. */
export async function fetchRiotFeed(id: number) {
  const news = await fetchRiotNews(id);
  const items = (news ?? []).slice(0, 30).map((item) => ({
    id: item.id,
    steamAppId: id,
    title: item.title,
    official: true,
    url: item.url,
    publishedAt: item.publishedAt,
    category: item.category,
    cleanSummary: item.summary,
    // Riot's listing has no change lines; topics come from title + summary.
    digest: { topics: digestNews(item.summary, item.title).topics, line: null },
    patchCounts: null,
    source: "riot" as const,
  }));
  return {
    available: news !== null,
    patchNotes: items.filter((item) => item.category === "patch_note"),
    events: items.filter((item) => item.category !== "patch_note"),
  };
}

/** Steam-appdetails-shaped facts for a Riot game (all free to play). */
export function riotMetadata(id: number) {
  const game = riotGame(id);
  if (!game) return null;
  return {
    name: game.title,
    is_free: true,
    short_description: game.description,
    header_image: `/api/art/${id}/header`,
    developers: ["Riot Games"],
    genres: undefined,
    price_overview: undefined,
  };
}

/** Newest article art, used as the game's header and hero. */
export async function riotArtUrl(id: number) {
  const news = await fetchRiotNews(id);
  return (
    news?.find((item) => item.category === "patch_note" && item.image)?.image ??
    news?.find((item) => item.image)?.image ??
    null
  );
}
