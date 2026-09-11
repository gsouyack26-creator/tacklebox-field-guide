const CACHE = "tacklebox-field-guide-v23";
const SHELL = [
  "./", "./index.html", "./styles.css?v=23", "./data.js?v=23", "./manual-data.js?v=23", "./app.js?v=23",
  "./advisor-data.js?v=23", "./advisor-engine.js?v=23", "./lure-products.js?v=23", "./salt-line-products.js?v=23",
  "./coastal-report.json", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith("tacklebox-field-guide-") && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request)
      .then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      })
      .catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    const update = fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || update;
  }));
});
