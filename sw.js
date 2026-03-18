const CACHE_NAME = 'hub-semillero-v2';
const OFFLINE_URL = './index.html';

// Recursos a pre-cachear en instalación
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.png',
  // Fuentes externas
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// ── INSTALL: pre-cache recursos esenciales ──
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando HUB Semillero v2...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando recursos...');
      return Promise.allSettled(
        PRECACHE_URLS.map(url => 
          cache.add(url).catch(err => 
            console.warn('[SW] No se pudo cachear:', url, err.message)
          )
        )
      );
    }).then(() => {
      console.log('[SW] Instalación completada');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activación completada, tomando control');
      return self.clients.claim();
    })
  );
});

// ── FETCH: estrategia Cache-First con fallback a red ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no son GET
  if (request.method !== 'GET') return;

  // Ignorar extensiones de Chrome y datos internos
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'data:' ||
      url.hostname === 'localhost' && url.port !== '') return;

  // Ignorar API calls (Gemini, EmailJS, etc.)
  const apiHosts = [
    'generativelanguage.googleapis.com',
    'api.emailjs.com',
    'cdn.jsdelivr.net',
    'api.anthropic.com'
  ];
  if (apiHosts.some(h => url.hostname.includes(h))) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Tenemos en cache — devolver y actualizar en background
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse); // Si falla red, usar cache
        
        return cachedResponse; // Retornar cache inmediatamente (stale-while-revalidate)
      }

      // No está en cache — ir a red
      return fetch(request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cachear recursos estáticos y fuentes
          const shouldCache = 
            request.destination === 'document' ||
            request.destination === 'script' ||
            request.destination === 'style' ||
            request.destination === 'font' ||
            request.destination === 'image' ||
            url.hostname.includes('fonts.googleapis.com') ||
            url.hostname.includes('fonts.gstatic.com') ||
            url.hostname.includes('cdnjs.cloudflare.com');

          if (shouldCache) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          // Sin red y sin cache → fallback offline
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Offline', { 
            status: 503, 
            statusText: 'Service Unavailable' 
          });
        });
    })
  );
});

// ── MENSAJE: actualizar SW manualmente ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Actualizando por petición del cliente...');
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// ── PUSH NOTIFICATIONS (para futuras funciones) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nueva notificación del HUB Semillero',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'hub-semillero-notif',
      data: { url: data.url || './' },
      actions: [
        { action: 'open', title: 'Abrir HUB' },
        { action: 'close', title: 'Cerrar' }
      ]
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'HUB Semillero', options)
    );
  } catch(e) {
    console.warn('[SW] Error en push:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || './')
    );
  }
});

console.log('[SW] Service Worker HUB Semillero cargado ✅');
