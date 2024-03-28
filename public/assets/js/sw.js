// Define the cache name
const cacheName = 'my-app-cache-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => {
        return cache.addAll([
          '/',
          '.../views/web/offlineserver/index.html',
          '.../views/web/offlineserver/styles.css',
          '.../views/web/offlineserver/app.js'
        ]);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.filter(name => name !== cacheName)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        if (!navigator.onLine) {
          return new Response(`
            <html>
              <body>
                <h1>It looks like you're offline. Connect back to the internet to continue.</h1>
              </body>
            </html>
          `, {
            headers: { 'Content-Type': 'text/html' }
          });
        }

        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(cacheName)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(error => {
        console.log('Error in fetch event:', error);
      })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
