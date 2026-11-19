import { z } from "zod/v4";

import type { DealItemSchema, SteamMatch } from "@acme/validators";
import {
  baseTitle,
  isRiotGame,
  normalizeEditionTitle,
  normalizeSteamPackageTitle,
  parseSteamStoreSearch,
} from "@acme/validators";

import { fetchGameMetadata, fetchJson, steamPrice } from "./steam-discovery";

type Deal = z.infer<typeof DealItemSchema>;
interface TitleMatch {
  steamAppId: number;
  matchedBy: "title";
}
interface PackageMatch extends SteamMatch {
  matchedBy: "edition-package";
  packageId: number;
}
interface SteamPackage {
  title: string;
  packageId: number;
  price: number;
}

const matchTtlMs = 24 * 60 * 60 * 1000;
const matchBudgetMs = 6000;
const titleCache = new Map<
  string,
  { match: TitleMatch | PackageMatch | null; expiresAt: number }
>();
const packageCache = new Map<
  number,
  { packages: SteamPackage[]; expiresAt: number }
>();
let nextSweepAt = 0;

const packageSubSchema = z.object({
  packageid: z.number().int().positive(),
  option_text: z.string(),
  price_in_cents_with_discount: z.number().int().nonnegative(),
});
const appPackageDetailsSchema = z.record(
  z.string(),
  z.object({
    success: z.literal(true),
    data: z.object({
      price_overview: z.object({ currency: z.string() }).nullish(),
      package_groups: z
        .array(
          z
            .object({ subs: z.array(z.unknown()).catch([]) })
            .catch({ subs: [] }),
        )
        .default([]),
    }),
  }),
);

async function searchSteam(title: string) {
  const response = await fetchJson(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&cc=US&l=english`,
  );
  if (!response || typeof response !== "object") return;
  const hasItems = "items" in response && Array.isArray(response.items);
  const empty = "total" in response && response.total === 0;
  if (hasItems || empty) {
    return parseSteamStoreSearch(response).filter(
      (app) =>
        !isRiotGame(app.steamAppId) &&
        normalizeEditionTitle(app.title) === title,
    );
  }
}

async function fetchSteamPackages(steamAppId: number) {
  const cached = packageCache.get(steamAppId);
  if (cached && cached.expiresAt > Date.now()) return cached.packages;

  const response = appPackageDetailsSchema.safeParse(
    await fetchJson(
      `https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=us&l=en`,
      4000,
    ),
  );
  const details = response.success
    ? response.data[steamAppId]?.data
    : undefined;
  if (!details) return;

  const packages: SteamPackage[] = [];
  if (!details.price_overview || details.price_overview.currency === "USD") {
    for (const { subs } of details.package_groups) {
      for (const sub of subs) {
        const parsed = packageSubSchema.safeParse(sub);
        if (!parsed.success) continue;
        const { packageid, option_text, price_in_cents_with_discount } =
          parsed.data;
        packages.push({
          title: normalizeSteamPackageTitle(option_text),
          packageId: packageid,
          price: price_in_cents_with_discount / 100,
        });
      }
    }
  }
  packageCache.set(steamAppId, {
    packages,
    expiresAt: Date.now() + matchTtlMs,
  });
  return packages;
}

async function findSteamMatch(
  title: string,
  deadlineAt: number,
): Promise<TitleMatch | PackageMatch | null | undefined> {
  const exactApps = await searchSteam(title);
  const exact = exactApps?.[0];
  if (exact) return { steamAppId: exact.steamAppId, matchedBy: "title" };

  const base = baseTitle(title);
  if (!base || base === title) return exactApps ? null : undefined;
  if (performance.now() >= deadlineAt) return;

  const baseApps = await searchSteam(base);
  if (!baseApps) return;

  // An outage or deadline can leave a candidate unchecked. Cache definitive misses only.
  let complete = exactApps !== undefined;
  for (const { steamAppId } of baseApps.slice(0, 3)) {
    if (performance.now() >= deadlineAt) return;
    const packages = await fetchSteamPackages(steamAppId);
    const match = packages?.find((sub) => sub.title === title);
    if (match) {
      return {
        steamAppId,
        packageId: match.packageId,
        price: match.price,
        matchedBy: "edition-package",
      };
    }
    if (!packages) complete = false;
  }
  return complete ? null : undefined;
}

const waiting: (() => void)[] = [];
let active = 0;

async function matchSteamEdition(
  title: string,
  deadlineAt: number,
): Promise<SteamMatch | null> {
  const normalized = normalizeEditionTitle(title);
  if (!normalized) return null;

  // Share six in-flight slots across requests to limit load on Steam.
  if (active < 6) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    if (performance.now() >= deadlineAt) return null;
    const cached = titleCache.get(normalized);
    let match = cached?.match;
    if (!cached || cached.expiresAt <= Date.now()) {
      match = await findSteamMatch(normalized, deadlineAt);
      if (match !== undefined) {
        // Reusing appdetails must not extend the lifetime of its price.
        const packageExpiresAt =
          match?.matchedBy === "edition-package"
            ? packageCache.get(match.steamAppId)?.expiresAt
            : undefined;
        titleCache.set(normalized, {
          match,
          expiresAt: packageExpiresAt ?? Date.now() + matchTtlMs,
        });
      }
    }
    if (!match || performance.now() >= deadlineAt) return null;
    if (match.matchedBy === "edition-package") return match;

    // App-title matches use the existing short live price cache.
    const price = steamPrice(await fetchGameMetadata(match.steamAppId));
    return price ? { ...match, price: price.current } : null;
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
  if (!unmatched.length) return enriched;

  const now = Date.now();
  if (now >= nextSweepAt) {
    for (const [key, entry] of titleCache) {
      if (entry.expiresAt <= now) titleCache.delete(key);
    }
    for (const [key, entry] of packageCache) {
      if (entry.expiresAt <= now) packageCache.delete(key);
    }
    nextSweepAt = now + matchTtlMs;
  }

  const deadlineAt = performance.now() + matchBudgetMs;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, matchBudgetMs);
  });
  try {
    await Promise.race([
      deadline,
      Promise.all(
        unmatched.map(async ({ offer, index }) => {
          const steamMatch = await matchSteamEdition(offer.title, deadlineAt);
          if (steamMatch && performance.now() < deadlineAt) {
            enriched[index] = { ...offer, steamMatch };
          }
        }),
      ),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  return enriched;
}
