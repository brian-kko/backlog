import type { z } from "zod/v4";

import type { DealItemSchema, SteamMatch } from "@acme/validators";
import {
  isExactEditionMatch,
  isRiotGame,
  normalizeEditionTitle,
  parseSteamStoreSearch,
} from "@acme/validators";

import { fetchGameMetadata, fetchJson, steamPrice } from "./steam-discovery";

type Deal = z.infer<typeof DealItemSchema>;
const matchTtlMs = 24 * 60 * 60 * 1000;
const titleCache = new Map<
  string,
  { steamAppId: number | null; expiresAt: number }
>();
let nextSweepAt = 0;

async function findSteamAppId(title: string) {
  const now = Date.now();
  if (now >= nextSweepAt) {
    for (const [key, entry] of titleCache) {
      if (entry.expiresAt <= now) titleCache.delete(key);
    }
    nextSweepAt = now + matchTtlMs;
  }
  const cached = titleCache.get(title);
  if (cached && cached.expiresAt > now) return cached.steamAppId;

  const response = await fetchJson(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&cc=US&l=english`,
  );
  if (!response || typeof response !== "object") return null;
  const hasItems = "items" in response && Array.isArray(response.items);
  const empty = "total" in response && response.total === 0;
  if (!hasItems && !empty) return null;

  const match = parseSteamStoreSearch(response).find(
    (app) =>
      !isRiotGame(app.steamAppId) && isExactEditionMatch(title, app.title),
  );
  const steamAppId = match?.steamAppId ?? null;
  titleCache.set(title, { steamAppId, expiresAt: Date.now() + matchTtlMs });
  return steamAppId;
}

const waiting: (() => void)[] = [];
let active = 0;

async function matchSteamEdition(title: string): Promise<SteamMatch | null> {
  const normalized = normalizeEditionTitle(title);
  if (!normalized) return null;

  // Share six in-flight slots across requests to limit load on Steam.
  if (active < 6) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    const steamAppId = await findSteamAppId(normalized);
    if (steamAppId === null) return null;
    // Cache app identity for a day. Prices use the existing short live cache.
    const price = steamPrice(await fetchGameMetadata(steamAppId));
    return price
      ? { steamAppId, price: price.current, matchedBy: "title" }
      : null;
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export async function addSteamEditionMatches(offers: Deal[]) {
  const unmatched = offers
    .map((offer, index) => ({ offer, index }))
    .filter(({ offer }) => offer.steamAppId == null)
    .slice(0, 40);
  const enriched: (Deal & { steamMatch?: SteamMatch })[] = [...offers];
  await Promise.all(
    unmatched.map(async ({ offer, index }) => {
      const steamMatch = await matchSteamEdition(offer.title);
      if (steamMatch) enriched[index] = { ...offer, steamMatch };
    }),
  );
  return enriched;
}
