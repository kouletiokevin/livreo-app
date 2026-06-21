/* DINVMIC — Service Worker v55 */
const CACHE = 'dinvmic-v55';
const ASSETS = [
  './',
  './css/style.css',
  './js/supabase.js',
  './js/app.js',
  './js/auth.js',
  './js/home.js',
  './js/explorer.js',
  './js/livreur.js',
  './js/suivi.js',
  './js/poster.js',
  './js/booster.js',
  './js/profil.js',
  './js/affil.js',
  './js/admin.js',
  './js/messages.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (!url.startsWith('http')) return;
  // HTML : réseau d'abord (jamais de page périmée/tronquée)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  if (url.includes('supabase') || url.includes('stripe') || url.includes('twilio')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
      return cached || fresh;
    })
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  self.registration.showNotification(data.title || 'DINVMIC', {
    body: data.body || '',
    icon: './favicon.svg',
    badge: './favicon.svg',
    tag: data.tag || 'dinvmic-notif',
    data: data.url || './'
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data || './'));
});
