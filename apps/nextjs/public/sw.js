// Backlog service worker: keeps the app shell available offline.
// Guest collections live in localStorage, so a cached shell can show them.
// API responses (prices, news) are never cached; the UI marks them
// unavailable while offline.
const version = new URL(self.location.href).searchParams.get("v") ?? "dev";
const CACHE = `backlog-shell-${version}`;
const SHELL = ["/", "/library", "/wishlist", "/updates", "/deals"];

// Caches each shell page and every build asset it references, so a cold
// offline start can render the page and run its scripts.
async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  for (const path of SHELL) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Precache failed for ${path}`);
    await cache.put(path, response.clone());
    const html = await response.text();
    for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g))
      assets.add(match[0]);
  }
  await cache.addAll([...assets, "/icon.svg", "/manifest.webmanifest"]);
}

self.addEventListener("install", (event) => {
  // A failed precache fails installation, so a half-cached shell never activates.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("backlog-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function fromNetwork(request) {
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    void caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/"))
    return;

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fromNetwork(request)),
    );
    return;
  }

  // Pages: network first, then the cached copy, then the cached dashboard.
  // Client-side navigations that fail offline fall back to a full page load,
  // which lands here too.
  if (request.mode === "navigate") {
    event.respondWith(
      fromNetwork(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (
          (await cache.match(request, { ignoreSearch: true })) ??
          (await cache.match("/")) ??
          Response.error()
        );
      }),
    );
  }
});
