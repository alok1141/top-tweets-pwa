const CACHE_NAME = 'top-tweets-pwa-v1';
const STATIC_ASSETS = [
  '.',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // For navigation requests, return cached index.html if offline
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }
  // otherwise try cache first
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).catch(()=>caches.match('./index.html'))));
});


// const CACHE_NAME = 'top-tweets-pwa-v1';
// const STATIC_ASSETS = [
//   '.',
//   './index.html',
//   './style.css',
//   './app.js',
//   './manifest.json'
// ];

// self.addEventListener('install', e => {
//   e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
//   self.skipWaiting();
// });

// self.addEventListener('activate', e => {
//   e.waitUntil(clients.claim());
// });

// self.addEventListener('fetch', e => {
//   // offline-first for same-origin static assets
//   if (e.request.method !== 'GET') return;
//   e.respondWith(
//     caches.match(e.request).then(cached => {
//       return cached || fetch(e.request).catch(() => {
//         // fallback to index.html for navigation
//         if (e.request.mode === 'navigate') {
//           return caches.match('./index.html');
//         }
//       });
//     })
//   );
// });
