// Bump VERSION on every release so clients pick up new files.
const VERSION = 'pos-pro-v23';
const SHELL = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './main.js', './core-app.js', './core-db.js', './core-timer.js',
  './domain-catalog.js', './domain-program.js', './domain-progression.js', './domain-analytics.js',
  './domain-backup.js', './domain-units.js', './domain-calendar.js', './domain-workout.js',
  './domain-personalize.js', './domain-court.js', './domain-padel.js', './domain-taxonomy.js', './domain-importer.js', './domain-muscles.js', './domain-builder.js', './domain-recovery.js', './domain-adaptive.js', './domain-stats.js', './domain-overview.js', './domain-pain.js', './domain-plates.js', './domain-body.js', './ui-body.js', './domain-review.js', './ui-review.js', './ui-feedback.js', './ui-picker.js',
  './ui-kit.js', './ui-today.js', './ui-workout.js', './ui-history.js', './ui-plan.js', './ui-settings.js',
  './ui-court.js', './ui-welcome.js', './ui-words.js', './ui-library.js', './ui-locations.js', './ui-bodymap.js', './ui-builder.js', './ui-recovery.js', './ui-stats.js', './ui-overview.js', './ui-backup.js',
  './icon-180.png', './icon-192.png', './icon-512.png',
];

self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));

// Network-first for same-origin files (fresh when online), cache fallback offline.
// `no-cache` makes the browser re-check every file with the server (a cheap "has it changed?"
// request) instead of trusting its 10-minute HTTP cache, so an update never mixes new and old files.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const fresh = e.request.mode === 'navigate' ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(fetch(fresh).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs[0] ? cs[0].focus() : self.clients.openWindow('./#/workout')));
});
