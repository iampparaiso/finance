const CACHE = 'finance-os-v1';
const PRECACHE = [
  '/finance/',
  '/finance/index.html',
  '/finance/manifest.json',
  '/finance/css/tokens.css',
  '/finance/css/app.css',
  '/finance/js/app.js',
  '/finance/js/api.js',
  '/finance/js/format.js',
  '/finance/js/calendar.js',
  '/finance/js/dashboard.js',
  '/finance/js/cards.js',
  '/finance/js/installments.js',
  '/finance/js/loans.js',
  '/finance/js/bills.js',
  '/finance/js/renovation.js',
  '/finance/js/emergency-fund.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"ok":false,"error":"Offline"}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
