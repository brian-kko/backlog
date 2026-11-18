import { z } from "zod/v4";

/**
 * Riot's PC games aren't on Steam. They get IDs from a reserved block far
 * above any Steam AppID (Steam's are in the low millions), so every table,
 * route and export that keys games by `steamAppId` keeps working unchanged.
 */
export const RIOT_ID_BASE = 2_000_000_000;

export interface RiotGame {
  id: number;
  slug: string;
  title: string;
  /** Short names people search by: "lol", "val", "tft". */
  aliases: readonly string[];
  /** Riot's own site for the game (store link, news, art). */
  site: string;
  /** Riot's news listing that carries this game's patch notes. */
  newsUrl: string;
  releaseYear: number;
  description: string;
}

export const riotGames: readonly RiotGame[] = [
  {
    id: RIOT_ID_BASE + 1,
    slug: "league-of-legends",
    title: "League of Legends",
    aliases: ["lol", "league"],
    site: "https://www.leagueoflegends.com",
    newsUrl: "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/",
    releaseYear: 2009,
    description:
      "A team-based strategy game where two teams of five champions battle to destroy the other's base.",
  },
  {
    id: RIOT_ID_BASE + 2,
    slug: "valorant",
    title: "VALORANT",
    aliases: ["val", "valorant"],
    site: "https://playvalorant.com",
    newsUrl: "https://playvalorant.com/en-us/news/tags/patch-notes/",
    releaseYear: 2020,
    description:
      "A 5v5 character-based tactical shooter where precise gunplay meets unique agent abilities.",
  },
  {
    id: RIOT_ID_BASE + 3,
    slug: "teamfight-tactics",
    title: "Teamfight Tactics",
    aliases: ["tft"],
    site: "https://teamfighttactics.leagueoflegends.com",
    newsUrl:
      "https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/",
    releaseYear: 2019,
    description:
      "A round-based strategy game where you draft, deploy and power up a team of champions against seven opponents.",
  },
];

export const riotGame = (id: number | null | undefined) =>
  riotGames.find((game) => game.id === id);

export const isRiotGame = (id: number | null | undefined) =>
  riotGame(id) !== undefined;

/** Riot titles matching a search, by title words or a short alias. */
export function searchRiotGames(query: string): RiotGame[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  return riotGames.filter(
    (game) =>
      game.title.toLowerCase().includes(needle) ||
      game.aliases.some((alias) => alias.startsWith(needle)) ||
      (needle.length >= 3 && "riot games".startsWith(needle)),
  );
}

/** Image hosts Riot's news pages use; anything else is ignored. */
export const riotImageHosts = ["cmsassets.rgpub.io"] as const;
const linkHosts = [
  "leagueoflegends.com",
  "playvalorant.com",
  "riotgames.com",
  "youtube.com",
];

export interface RiotNewsItem {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  /** Riot's own one-line summary, as plain text. */
  summary: string;
  image: string | null;
  category: "patch_note" | "event";
}

const cardSchema = z.object({
  title: z.string().min(1),
  publishedAt: z.string(),
  action: z
    .object({
      type: z.string(),
      payload: z.object({ url: z.string() }).partial().optional(),
    })
    .optional(),
  media: z.object({ url: z.string() }).partial().nullish(),
  description: z.object({ body: z.string() }).partial().nullish(),
  analytics: z.object({ contentId: z.string() }).partial().nullish(),
});

const decode = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const plainText = (html: string) =>
  decode(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

// Pure-TS package (no DOM/Node URL): accept root-relative paths on the game's
// site, or absolute https URLs on an allowed host with no credentials/port.
const absolute = /^https:\/\/([a-z0-9.-]+)(?=[/?#]|$)/i;
function safeUrl(raw: string | undefined, base: string, hosts: string[]) {
  if (!raw) return null;
  const href = /^\/(?!\/)/.test(raw) ? `${base}${raw}` : raw;
  const host = absolute.exec(href)?.[1]?.toLowerCase();
  if (!host || /\s/.test(href)) return null;
  const allowed = hosts.some(
    (name) => host === name || host.endsWith(`.${name}`),
  );
  return allowed ? href : null;
}

// "League of Legends Patch 26.23 Notes", "VALORANT Patch Notes 13.10",
// "Teamfight Tactics patch 18.7". Video "Rundowns" are news, not notes.
const patchTitle = /\bpatch\b[^|]*\d/i;

/**
 * Reads the article cards Riot embeds in a news page (its Next.js page data).
 * Returns null when the page no longer has that shape, so callers can say the
 * feed is unavailable instead of "no updates".
 */
export function parseRiotNews(
  html: string,
  game: RiotGame,
): RiotNewsItem[] | null {
  const match =
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html,
    );
  if (!match?.[1]) return null;
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  const blades = z
    .object({
      props: z.object({
        pageProps: z.object({
          page: z.object({ blades: z.array(z.unknown()) }),
        }),
      }),
    })
    .safeParse(data);
  if (!blades.success) return null;
  const cards = blades.data.props.pageProps.page.blades.flatMap((blade) => {
    const items = z.object({ items: z.array(z.unknown()) }).safeParse(blade);
    return items.success ? items.data.items : [];
  });
  const seen = new Set<string>();
  const results: RiotNewsItem[] = [];
  for (const raw of cards) {
    const card = cardSchema.safeParse(raw);
    if (!card.success) continue;
    const publishedAt = new Date(card.data.publishedAt);
    const url = safeUrl(card.data.action?.payload?.url, game.site, linkHosts);
    if (!url || Number.isNaN(publishedAt.getTime()) || seen.has(url)) continue;
    seen.add(url);
    const isVideo = card.data.action?.type !== "weblink";
    results.push({
      id: card.data.analytics?.contentId ?? url,
      title: plainText(card.data.title),
      url,
      publishedAt,
      summary: plainText(card.data.description?.body ?? ""),
      image: safeUrl(card.data.media?.url, game.site, [...riotImageHosts]),
      category:
        !isVideo && patchTitle.test(card.data.title) ? "patch_note" : "event",
    });
  }
  return results.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
}
