// ══════════════════════════════════════════════════
// SERVICE WORKER — HUB Semillero Padre Luis Toro
// Version: 3.0 | Marzo 2026
// ══════════════════════════════════════════════════

const CACHE = 'hub-semillero-v3';
const OFFLINE = './index.html';

// Pre-cache on install
self.addEventListener('install', e => {
  console.log('[SW] Installing v3...');
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled([
        c.add('./index.html').catch(() => {}),
        c.add('./manifest.json').catch(() => {}),
        c.add('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap').catch(() => {}),
        c.add('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css').catch(() => {}),
      ])
    ).then(() => {
      console.log('[SW] Pre-cache done');
      return self.skipWaiting();
    })
  );
});

// Clean old caches on activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first, network fallback
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip non-HTTP(S), API calls, and chrome-extension
  if (!['http:', 'https:'].includes(url.protocol)) return;
  const skipHosts = [
    'generativelanguage.googleapis.com',
    'api.groq.com',
    'api.emailjs.com',
    'cdn.jsdelivr.net'
  ];
  if (skipHosts.some(h => url.hostname.includes(h))) return;

  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Return cache immediately, update in background
        fetch(request).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            caches.open(CACHE).then(c => c.put(request, res));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then(res => {
        if (!res || res.status !== 200) return res;

        // Cache static assets and fonts
        const shouldCache = ['document','script','style','font','image'].includes(request.destination)
          || url.hostname.includes('fonts.g') || url.hostname.includes('cdnjs');

        if (shouldCache) {
          caches.open(CACHE).then(c => c.put(request, res.clone()));
        }
        return res;
      }).catch(() => {
        if (request.destination === 'document') {
          return caches.match(OFFLINE);
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Message handler
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'GET_VERSION') {
    e.ports[0]?.postMessage({ version: CACHE });
  }
});

// Push notifications (future use)
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const d = e.data.json();
    e.waitUntil(
      self.registration.showNotification(d.title || 'HUB Semillero', {
        body: d.body || 'Nueva notificación',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'hub-notif',
        data: { url: d.url || './' }
      })
    );
  } catch(err) {}
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || './'));
});

console.log('[SW] HUB Semillero v3 loaded ✅');
