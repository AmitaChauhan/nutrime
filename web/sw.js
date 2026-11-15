// The app used to live at the site root. This retires that old offline copy so the
// front page shows the landing page and the app runs from /app/ with its own cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => !k.startsWith("nutrime-app-")).map(k => caches.delete(k)));
  await self.registration.unregister();
  const wins = await self.clients.matchAll({ type: "window" });
  wins.forEach(w => w.navigate(w.url).catch(() => {}));
})()));
