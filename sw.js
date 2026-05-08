const CACHE_NAME = 'vps-control-v3';
// Chi cache cac file TINH (khong bao gio thay doi)
const STATIC_ASSETS = ['./style.css', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ));
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = e.request.url;
    // Khong bao gio cache: API calls VPS, file JS, file HTML => luon lay tu network
    if (url.includes(':4000') || url.includes('.js') || url.includes('.html') || url.endsWith('/')) {
        return; // Pass-through: lay thang tu network
    }
    // Chi cache file tinh (css, icons)
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});