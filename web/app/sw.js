// Keeps the app shell available offline. Claude calls always go to the network.
const CACHE = "nutrime-app-v10";
const SHELL = ["./", "index.html", "anthropic-sdk.js", "journal.js", "move.js", "config.js", "native-health.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("nutrime-app-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin && !url.pathname.startsWith(new URL("./", self.registration.scope).pathname)) return; // only handle the app itself, never /api/ or the landing page
  if (url.origin === location.origin) {
    // Network first so updates show up, cache as fallback when offline.
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
  } else if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })));
  }
});
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
