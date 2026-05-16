/* StepUp Tours — service worker
 * Acelera las revisitas en web cacheando el shell de la app.
 * - Assets versionados (hash en el nombre, /_expo/static/**) → cache-first.
 * - Navegación / HTML → network-first (siempre sirve el index más reciente).
 * - /api/ y /jsonapi/ → nunca se cachean (datos dinámicos y analíticas).
 * Solo cachea respuestas del mismo origen para evitar respuestas opacas.
 */
const CACHE = 'sut-static-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

const ASSET_RE = /\.(js|css|woff2?|ttf|otf|png|jpe?g|svg|gif|avif|webp|ico)$/i;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Nunca cachear API ni datos dinámicos — dejar pasar a la red.
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/jsonapi/')) {
    return;
  }

  const sameOrigin = url.origin === self.location.origin;

  // Assets versionados → cache-first (solo mismo origen).
  if (sameOrigin && (url.pathname.startsWith('/_expo/') || ASSET_RE.test(url.pathname))) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navegación / HTML → network-first con fallback a caché.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (await cache.match(req)) || (await cache.match('/')) || Response.error();
        }),
    );
  }
});
