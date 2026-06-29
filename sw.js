// ====================================================================
// WSCF MEMBERSHIP APP - SERVICE WORKER
// ARCHITECTED BY PROSPER (PP STUDIO) | PWA OFFLINE SUPPORT
// ====================================================================

const CACHE_NAME = 'wscf-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/assets/logo.png.jpeg',
  '/assets/icons/icon-192x192-v2.png',
  '/assets/icons/icon-512x512-v2.png'
];

// ====================================================================
// INSTALL EVENT - Cache core layout files
// ====================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Installing Service Worker & caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// ====================================================================
// ACTIVATE EVENT - Clean up old caches
// ====================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Ensure the service worker takes control of all clients immediately
      return self.clients.claim();
    })
  );
});

// ====================================================================
// FETCH EVENT - Network-first strategy with cache fallback
// ====================================================================
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Supabase API calls - they need to be fresh
  if (event.request.url.includes('supabase') || 
      event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone();
        
        // Only cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        
        return response;
      })
      .catch(() => {
        // If network fails, try the cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // For HTML pages, return the cached index.html as fallback
          if (event.request.headers.get('Accept').includes('text/html')) {
            return caches.match('/index.html');
          }
          
          // Return a fallback response
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// ====================================================================
// MESSAGE EVENT - Handle skip waiting messages from the client
// ====================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});