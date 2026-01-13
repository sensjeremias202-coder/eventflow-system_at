// Service Worker básico para Eventflow (cache offline)
const VERSION = 'v4';
const STATIC_CACHE = `static-${VERSION}`;
const API_CACHE = `api-${VERSION}`;

const STATIC_FILES = [
  '/eventflow-system_at/index.html',
  '/eventflow-system_at/styles.css',
  '/eventflow-system_at/config.js',
  '/eventflow-system_at/api.js',
  '/eventflow-system_at/script.js',
  '/eventflow-system_at/pages/events.html',
  '/eventflow-system_at/pages/dashboard.html',
  '/eventflow-system_at/pages/calendar.html',
  '/eventflow-system_at/pages/chat.html',
  '/eventflow-system_at/pages/event-details.html',
  '/eventflow-system_at/pages/profile.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    for (const url of STATIC_FILES) {
      try {
        const req = new Request(url, { cache: 'reload' });
        const res = await fetch(req);
        if (res && res.ok) {
          await cache.put(req, res);
        } else {
          // Ignora arquivos que retornam erro
          console.warn('[SW] ignorando precache não-OK:', url, res && res.status);
        }
      } catch (e) {
        console.warn('[SW] falha ao precachear:', url, e && e.message);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => {
      if (!k.includes(VERSION)) return caches.delete(k);
    }))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const accept = event.request.headers.get('accept') || '';
  // Documentos HTML: network-first para evitar páginas desatualizadas
  const isDocument = event.request.destination === 'document' || accept.includes('text/html') || url.pathname.endsWith('.html');
  if (isDocument) {
    event.respondWith(
      fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(event.request, copy));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first para API de eventos (GET)
  if (url.pathname.startsWith('/api/events') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(API_CACHE).then(c => c.put(event.request, copy));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Default: tenta rede, cai para cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
