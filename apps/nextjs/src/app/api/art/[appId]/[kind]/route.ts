import { riotArtUrl } from "@acme/api";
import { isRiotGame } from "@acme/validators";

const assets = {
  header: ["header.jpg"],
  // Cards: Steam's 616×353 capsule is sharper than the 460×215 header.
  wide: ["capsule_616x353.jpg", "header.jpg"],
  hero: ["library_hero.jpg", "header.jpg"],
  capsule: ["library_600x900.jpg", "header.jpg"],
} as const;
const cacheControl = "public, max-age=86400, stale-while-revalidate=604800";
const ttl = 86_400_000;
// Several sizes per game (header, wide, hero, capsule) across a library.
const maxEntries = 256;
interface Artwork {
  body: ArrayBuffer;
  contentType: string;
  fallback?: boolean;
}
const cache = new Map<string, { artwork: Artwork; expires: number }>();
const pending = new Map<string, Promise<Artwork>>();
// Inlined (not read from public/) so it ships with serverless bundles.
const fallbackPng =
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAABACAIAAABqVuVZAAACA0lEQVR4nO3QCXLiQBBE0T6GFwRiFUiA2UEej7f7H2pKUaWWB6vaxmgDZ8Q/QOYzd95NVvvmnuvcUi3OT/L8O68rtakedU91+ln+oCUNW13J6468Hhck9YN20lgaTLgONQzTos4o8qWpH3CzLjXm5kmTeW/yIIXUgupT0TJruhpI68GM2wy5ObWVHnYj22LPBYtDsDwEBjoOnQ9A0MnTSYGgo+gsYwKCjq6ziscGOg6dFAg6is7qkYCgo+sIEHQ0nTUBQcehkwJBR9FZ/5kY6Dh0BAg6ms6GgKDj0Nk8ERB0dJ0MCDq5OgIEHU1n+xQa6Dh0tn8JCDq6DgNBR9URIOhoOrvn0EDHofMfEHQ+6+yeIwMdh44AQUfT2b9EBjoOnQ9A0MnTSYGgo+jsXwkIOrpOAgQdh87hdWqg49BhIOioOoc3AoKOrpMAQcehEwsQdBSd+H1qhmEPOppO/D5LgDjoHOkwSwZk++U6Rxo5QGm/TifXwQEkXb2O+/7XQMJ0jTrfOf5dINsV6Jz092Qg7kJ1fvD0h0C2i9A55+C5QFxjdc6/VgyQrSE6BT4qGIirUafwL6UA2SrTKe9CuUDCVKZO2eOrALIVqFPZ5kqBuDN1Kl5bA5DtJJ26RtYJxH2pU++8+oFsRzq172kckDA1hqahQE0LQAACEIAA1OAABCAAldo/orp02tApz/cAAAAASUVORK5CYII=";

function fallbackArt(): Artwork {
  return {
    body: Uint8Array.from(Buffer.from(fallbackPng, "base64")).buffer,
    contentType: "image/png",
    fallback: true,
  };
}

function appdetailsArtUrls(data: unknown, kind: keyof typeof assets): string[] {
  if (!data || typeof data !== "object") return [];
  // appdetails has no portrait cover (capsule_imagev5 is a 184×69 strip), so
  // a missing capsule stays missing and the client hides or swaps the slot.
  if (kind === "capsule") return [];
  const header = "header_image" in data ? data.header_image : undefined;
  // Hero art sits behind a title, so prefer logo-free, full-size art over
  // the 460×215 header (its baked-in wordmark would ghost behind the text):
  // the store page background (atmospheric, no UI), then a screenshot.
  const screenshot =
    "screenshots" in data && Array.isArray(data.screenshots)
      ? (data.screenshots[0] as { path_full?: unknown } | undefined)?.path_full
      : undefined;
  const background = "background_raw" in data ? data.background_raw : undefined;
  const candidates =
    kind === "hero" ? [background, screenshot, header] : [header];
  const urls = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      const url = new URL(candidate);
      if (
        url.protocol !== "https:" ||
        url.port ||
        url.username ||
        url.password ||
        ![
          "shared.akamai.steamstatic.com",
          "cdn.akamai.steamstatic.com",
          "shared.fastly.steamstatic.com",
        ].includes(url.hostname)
      )
        continue;
      url.search = "";
      url.hash = "";
      urls.add(url.href);
    } catch {
      // Ignore malformed URLs from upstream data.
    }
  }
  return [...urls];
}

async function fetchArt(url: string): Promise<Artwork | undefined> {
  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 },
      // Never follow a redirect to another host.
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (
      response.ok &&
      contentType &&
      ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        contentType,
      )
    ) {
      const body = await response.arrayBuffer();
      if (body.byteLength) return { body, contentType };
    } else {
      await response.body?.cancel();
    }
  } catch {
    // Try the next asset on missing art or an upstream outage.
  }
  return undefined;
}

async function resolveArt(
  appId: number,
  kind: keyof typeof assets,
): Promise<Artwork> {
  // Riot's games aren't on Steam: use their newest patch-notes banner as the
  // header and hero. There's no portrait cover, so covers get the plate and
  // the client hides or swaps them.
  if (isRiotGame(appId)) {
    const url = kind === "capsule" ? null : await riotArtUrl(appId);
    return (url ? await fetchArt(url) : undefined) ?? fallbackArt();
  }
  for (const asset of assets[kind]) {
    const resolved = await fetchArt(
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/${asset}`,
    );
    if (resolved) return resolved;
  }
  try {
    const response = await fetch(
      // Unfiltered: screenshots and background_raw aren't in filters=basic.
      `https://store.steampowered.com/api/appdetails?appids=${appId}`,
      {
        next: { revalidate: 86400 },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.ok) {
      const details = (await response.json()) as Record<
        string,
        { data?: unknown } | undefined
      >;
      for (const url of appdetailsArtUrls(details[appId]?.data, kind)) {
        const resolved = await fetchArt(url);
        if (resolved) return resolved;
      }
    } else {
      await response.body?.cancel();
    }
  } catch {
    // Missing art and upstream outages share the same local fallback.
  }
  return fallbackArt();
}

function artwork(appId: number, kind: keyof typeof assets) {
  const key = `${appId}/${kind}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve(cached.artwork);
  }
  cache.delete(key);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const request = resolveArt(appId, kind)
    .then((resolved) => {
      // Cache misses too, so absent Steam artwork is checked only once a day.
      cache.set(key, { artwork: resolved, expires: Date.now() + ttl });
      if (cache.size > maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      return resolved;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ appId: string; kind: string }> },
) {
  const { appId, kind } = await params;
  const id = Number(appId);
  if (
    !/^\d{1,10}$/.test(appId) ||
    !Number.isInteger(id) ||
    id <= 0 ||
    id > 2147483647 ||
    (kind !== "header" &&
      kind !== "hero" &&
      kind !== "capsule" &&
      kind !== "wide")
  ) {
    return new Response("Invalid artwork request", { status: 400 });
  }
  const resolved = await artwork(id, kind);
  return new Response(resolved.body, {
    headers: {
      "Content-Type": resolved.contentType,
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      // The plate is 96×64 so clients can detect it (see isFallbackArt).
      ...(resolved.fallback ? { "X-Gemuzu-Art": "fallback" } : {}),
    },
  });
}
