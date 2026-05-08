/**
 * PlaceMates service worker.
 *
 * Three jobs:
 *   1) App shell — keep the app openable offline (manifest, icons,
 *      a friendly /offline page, the static Next.js bundle).
 *   2) Runtime read caching — pages, RSC payloads, photos. Lets the
 *      user browse recently-seen places / plans on the subway.
 *   3) Replay queue — Background Sync replays mutations that the
 *      user fired while offline (toggle favourite, mark a visit, …).
 *      Queue lives in IndexedDB; the wrapper lives in
 *      src/lib/offline/queue.ts on the client side.
 *
 * Vanilla JS (not TypeScript) per Next.js docs — Next compiles
 * routes but not /public, so the SW ships as-is. Comments are
 * deliberately verbose because the SW is the part of the app
 * future-you will debug at midnight when offline behaves weirdly.
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `pm-static-${CACHE_VERSION}`;
const PAGES_CACHE = `pm-pages-${CACHE_VERSION}`;
const PHOTOS_CACHE = `pm-photos-${CACHE_VERSION}`;
const RSC_CACHE = `pm-rsc-${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, PHOTOS_CACHE, RSC_CACHE];

// Routes pre-cached on install so the app opens cold-offline.
const SHELL_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Use addAll with reqs that ignore search params so the offline
      // shell hits the cache regardless of query strings on first
      // load. Fail silently per-URL — a 404 on /offline would
      // otherwise reject the entire install.
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (res.ok) await cache.put(url, res);
          } catch {
            /* swallow — best effort */
          }
        }),
      );
    })(),
  );
  // Activate immediately on first install so the new SW handles
  // the next page load instead of waiting for tab close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous CACHE_VERSION generations.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("pm-") && !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// --- Fetch routing ---

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable — POST/PATCH/DELETE go through to the
  // network. (The offline write queue catches those at the call
  // site, not here.)
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Next.js static assets — fingerprinted, immutable, perfect
  // cache-first targets.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Public icons + manifest — also static.
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/icons/") ||
      url.pathname.endsWith(".webmanifest") ||
      url.pathname.startsWith("/favicon") ||
      url.pathname === "/apple-touch-icon.png")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Supabase storage photos — cross-origin, cache-first with
  // best-effort eviction. We don't run a strict LRU; the browser's
  // origin storage cap (typically tens-to-hundreds of MB) is the
  // safety net. If it bites we'll add a count-based trim here.
  if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/")) {
    event.respondWith(cacheFirst(request, PHOTOS_CACHE));
    return;
  }

  // Same-origin GET — pages + RSC payloads + API GETs. Network-first
  // so fresh data wins when online; cache fallback when offline.
  if (url.origin === self.location.origin) {
    // RSC requests carry the `RSC: 1` header. Same-origin treatment
    // works for both — they share the cache strategy. We bucket
    // RSC into its own cache so we can wipe it independently in
    // future if the schema changes.
    const isRSC = request.headers.get("RSC") === "1";
    const cacheName = isRSC ? RSC_CACHE : PAGES_CACHE;

    if (request.mode === "navigate") {
      event.respondWith(navigationHandler(request));
      return;
    }
    event.respondWith(networkFirst(request, cacheName));
    return;
  }

  // Cross-origin everything else (map tiles, geocoder APIs) — let
  // the browser do its thing. Map tiles are big and online-only is
  // an OK trade for v1.
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      // Don't await put — race-free and faster TTFB.
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    // No network and no cache — surface the error. Caller (browser
    // for images) will render its broken-image glyph.
    throw err;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    // Network failed → try cached version of THIS page first
    // (so a previously-visited /places/abc still renders), then
    // fall back to the generic /offline shell.
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    if (offline) return offline;
    // Absolute last resort — minimal HTML so the user sees
    // something other than the browser's "no internet" page.
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><p>Brak sieci.</p>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

// --- Background Sync — replay queued mutations ---
//
// The IndexedDB queue is owned by client code (src/lib/offline/queue.ts).
// We open the same DB here, drain pending entries, and POST each
// to its server-action endpoint. Successful entries are deleted;
// failures stay in the queue for the next sync attempt.

const QUEUE_DB = "pm-offline";
const QUEUE_STORE = "mutations";

self.addEventListener("sync", (event) => {
  if (event.tag !== "pm-replay-mutations") return;
  event.waitUntil(replayMutations());
});

// Some browsers (Safari notably) don't ship the Background Sync API.
// Periodic Sync isn't reliable either. As a fallback we replay on
// `online` events from inside the SW.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "pm-replay-now") {
    event.waitUntil(replayMutations());
  }
});

async function replayMutations() {
  const db = await openQueueDb();
  const tx = db.transaction(QUEUE_STORE, "readonly");
  const store = tx.objectStore(QUEUE_STORE);
  const all = await idbReqToPromise(store.getAll());

  for (const entry of all) {
    try {
      // Each entry stores the full Request shape — URL, headers,
      // body, plus a synthetic next-action header so Next.js
      // routes it back to the same server action.
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
        credentials: "include",
      });
      if (res.ok || res.status < 500) {
        // 4xx counts as "delivered" — the server made a deliberate
        // decision (e.g., the place was deleted in the meantime),
        // retrying won't help. Surface to the user via a message
        // post so the UI can show a toast.
        await deleteEntry(db, entry.id);
        await broadcast({
          type: res.ok ? "pm-replay-success" : "pm-replay-rejected",
          entry,
          status: res.status,
        });
      }
      // 5xx → leave in queue for next sync attempt.
    } catch {
      // Network died mid-replay → leave in queue, retry next time.
    }
  }
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteEntry(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve(undefined);
    req.onerror = () => reject(req.error);
  });
}

async function broadcast(payload) {
  const all = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of all) c.postMessage(payload);
}

// --- Push notifications scaffolding (Wave 3 will wire actually) ---
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "PlaceMates", {
      body: data.body,
      icon: data.icon ?? "/icons/icon-192.png",
      badge: "/favicon-32.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window" });
      // If a tab is already open, focus it and navigate; otherwise
      // open a new one. Cleaner UX than spawning duplicate tabs.
      const existing = all[0];
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
