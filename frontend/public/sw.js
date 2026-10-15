// ShunyaScape service worker: makes the site installable as an app.
// Nothing is cached, so players always get the latest game; page loads that
// fail (no connection) get a small offline notice instead of the browser's error.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShunyaScape · Offline</title><style>
html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#120b26;color:#f4f1ff;font:16px system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
h1{font-size:22px;margin:0 0 8px}p{margin:0 0 18px;color:#c9c2e6}button{padding:12px 22px;border:0;border-radius:12px;background:linear-gradient(180deg,#ffd25e,#f59e0b);color:#2a1600;font-weight:700;font-size:15px}
</style></head><body><div><h1>You're offline</h1><p>ShunyaScape needs a connection to drop into a match.</p><button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;
  event.respondWith(
    fetch(req).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
  );
});
