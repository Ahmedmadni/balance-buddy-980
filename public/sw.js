// رصد — Service Worker
// -------------------------------------------------------------
// Static-asset cache ONLY: stale-while-revalidate for same-origin GET
// requests to icons/fonts/scripts/styles/the manifest. Deliberately does
// NOT cache:
//   - Navigation/document requests — this is a server-rendered app, and
//     caching HTML could serve stale authenticated financial data.
//   - Supabase API/Auth/Storage calls — always cross-origin, so the
//     origin check below never matches them.
//   - Any mutation — only GET requests are ever intercepted.
// =============================================================

const CACHE_VERSION = "v2";
const STATIC_CACHE = `rasd-static-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/fonts/IBM-Plex-Sans-Arabic-Light.ttf",
  "/fonts/IBM-Plex-Sans-Arabic-Regular.ttf",
  "/fonts/IBM-Plex-Sans-Arabic-Medium.ttf",
  "/fonts/IBM-Plex-Sans-Arabic-SemiBold.ttf",
  "/fonts/IBM-Plex-Sans-Arabic-Bold.ttf",
  "/fonts/Cairo-Variable.ttf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        /* best-effort precache — a missing asset shouldn't block install */
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAssetRequest(url) {
  return /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|css|js|webmanifest)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return; // never touch mutations
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase or any third-party origin
  if (request.mode === "navigate") return; // never cache HTML documents/pages
  if (!isStaticAssetRequest(url)) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      // Stale-while-revalidate: serve the cached copy immediately if present,
      // refresh it in the background for next time.
      return cached || networkFetch;
    }),
  );
});
