// SERVICE WORKER — HUB Semillero Padre Luis Toro v5
const CACHE = 'hub-semillero-v5';
const OFFLINE = './index.html';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled([
        c.add('./index.html').catch(()=>{}),
        c.add('./manifest.json').catch(()=>{}),
        c.add('./icon.png').catch(()=>{}),
        c.add('./sw.js').catch(()=>{}),
        c.add('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap').catch(()=>{}),
        c.add('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css').catch(()=>{}),
      ])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!['http:','https:'].includes(url.protocol)) return;
  const skip = ['generativelanguage.googleapis.com','api.groq.com','api.emailjs.com',
                'cdn.jsdelivr.net','youtube.com','youtu.be','i.ytimg.com','ytimg.com'];
  if (skip.some(h => url.hostname.includes(h))) return;

  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        fetch(request).then(res => {
          if (res?.status === 200 && res.type !== 'opaque')
            caches.open(CACHE).then(c => c.put(request, res));
        }).catch(()=>{});
        return cached;
      }
      return fetch(request).then(res => {
        if (!res || res.status !== 200) return res;
        if (['document','script','style','font','image'].includes(request.destination)
            || url.hostname.includes('fonts.g') || url.hostname.includes('cdnjs'))
          caches.open(CACHE).then(c => c.put(request, res.clone()));
        return res;
      }).catch(() =>
        request.destination === 'document'
          ? caches.match(OFFLINE)
          : new Response('Sin conexión', {status:503})
      );
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
