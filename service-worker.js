// Prefisso dedicato a questa app: le cache sono condivise per origin
// (orsointraprendente.github.io), quindi un nome diverso evita che questa
// app cancelli o sovrascriva le cache di altre app sullo stesso dominio.
const CACHE_PREFIX = '24odg-grazie-';
const CACHE_NAME = CACHE_PREFIX + 'v2';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Installazione - caching dell'app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Attivazione - pulizia delle sole cache vecchie di QUESTA app
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names =>
        Promise.all(
          names
            .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map(name => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch - Network First con fallback su cache, SOLO per file statici same-origin.
// Tutto il resto (Supabase REST/Auth/Edge Functions, Telegram, CDN) passa
// direttamente in rete: niente dati o risposte autenticate finiscono in cache.
self.addEventListener('fetch', event => {
  const req = event.request;

  // Solo GET (POST/PATCH ecc. non sono cacheabili)
  if (req.method !== 'GET') return;

  // Solo stessa origine (esclude *.supabase.co, api.telegram.org, CDN)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    // no-cache: rivalida sempre con il server (ETag), così dopo un deploy
    // su GitHub Pages non resti fino a 10 minuti sulla versione vecchia
    fetch(req, { cache: 'no-cache' })
      .then(response => {
        // Metti in cache solo risposte valide (no 401/403/404/500, no 206)
        if (response.ok && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(req).then(cached => {
          if (cached) return cached;
          // Navigazione offline su una pagina non in cache: mostra l'app shell
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
