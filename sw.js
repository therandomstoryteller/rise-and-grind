const CACHE_NAME = 'riseandgrind-v11';
const ASSETS = [
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/ai.js',
  './js/templates.js',
  './js/gamification.js',
  './js/adaptive.js',
  './js/dashboard.js',
  './js/workout.js',
  './js/diet.js',
  './js/weight.js',
  './js/checklist.js',
  './js/progress.js',
  './js/settings.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.groq.com') || e.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }
  // Network-first for HTML so updates are always picked up immediately
  if (e.request.mode === 'navigate' || e.request.url.endsWith('index.html') || e.request.url.endsWith('sw.js')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for all other assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
