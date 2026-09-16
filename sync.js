/* ==========================================
   TRADING PLATFORM - Push Service Worker
   ========================================== */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

/* Receive background push */
self.addEventListener('push', event => {

  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'Price Alert',
      body: event.data ? event.data.text() : 'Your price alert has been triggered.'
    };
  }

  const title = data.title || 'Price Alert';

  const options = {
    body: data.body || 'Your price alert has been triggered.',

    icon: data.icon || './favicon.ico',

    badge: data.badge || './favicon.ico',

    tag: data.tag || 'price-alert',

    renotify: true,

    data: {
      url: data.url || './trading.html'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});


/* User taps notification */
self.addEventListener('notificationclick', event => {

  event.notification.close();

  const targetUrl =
    event.notification.data?.url ||
    './trading.html';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {

      for (const client of windowClients) {

        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }

      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

    })
  );

});
