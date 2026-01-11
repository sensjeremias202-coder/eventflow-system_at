// Service Worker básico para Eventflow (cache offline)
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const API_CACHE = `api-${VERSION}`;

const STATIC_FILES = [
  '/',
  '/eventflow-system_at/',
  '/eventflow-system_at/index.html',
  '/eventflow-system_at/styles.css',
  '/eventflow-system_at/config.js',
  '/eventflow-system_at/api.js',
  '/eventflow-system_at/script.js',
  '/eventflow-system_at/pages/events.html',
  '/eventflow-system_at/pages/dashboard.html',
  '/eventflow-system_at/pages/calendar.html',
  '/eventflow-system_at/pages/chat.html',
  '/eventflow-system_at/pages/profile.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_FILES)).then(()=>self.skipWaiting())
  );
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
  // Cache-first para arquivos estáticos do projeto
  const isStatic = STATIC_FILES.some(path => url.pathname === path);
  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(event.request, copy));
        return res;
      }))
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
