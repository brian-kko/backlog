const assets = {
  header: ["header.jpg"],
  hero: ["library_hero.jpg", "header.jpg"],
  capsule: ["library_600x900.jpg", "header.jpg"],
} as const;
const cacheControl = "public, max-age=86400, stale-while-revalidate=604800";
const ttl = 86_400_000;
const maxEntries = 64;
interface Artwork {
  body: ArrayBuffer;
  contentType: string;
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
  };
}

async function resolveArt(
  appId: number,
  kind: keyof typeof assets,
): Promise<Artwork> {
  for (const asset of assets[kind]) {
    try {
      const response = await fetch(
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/${asset}`,
        {
          next: { revalidate: 86400 },
          // Never follow a redirect to another host.
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        },
      );
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
      // Missing art and upstream outages share the same local fallback.
    }
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
    (kind !== "header" && kind !== "hero" && kind !== "capsule")
  ) {
    return new Response("Invalid artwork request", { status: 400 });
  }
  const resolved = await artwork(id, kind);
  return new Response(resolved.body, {
    headers: {
      "Content-Type": resolved.contentType,
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
