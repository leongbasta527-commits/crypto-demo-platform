/* ==========================================
   TRADING PLATFORM - Push Service Worker
   ========================================== */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});


/* ==========================================
   Build safe notification URL
   ========================================== */

function getTradingUrl() {
  /*
    registration.scope 在 GitHub Pages 会类似：

    https://leongbasta527-commits.github.io/crypto-demo-platform/

    所以这里生成：

    https://leongbasta527-commits.github.io/crypto-demo-platform/trading.html

    不会错误跳到：
    https://leongbasta527-commits.github.io/trading.html
  */

  return new URL('trading.html', self.registration.scope).href;
}


function getSafeNotificationUrl(rawUrl) {

  const fallback = getTradingUrl();

  if (!rawUrl) {
    return fallback;
  }

  try {

    /*
      如果后台传的是：
      ./trading.html
      trading.html

      都以 Service Worker scope 为基础。
    */
    if (
      rawUrl === 'trading.html' ||
      rawUrl === './trading.html'
    ) {
      return fallback;
    }

    /*
      如果后台错误传：
      /trading.html

      不让它跳到 GitHub Pages 域名根目录，
      仍然使用项目里的 trading.html。
    */
    if (rawUrl === '/trading.html') {
      return fallback;
    }

    const resolved = new URL(
      rawUrl,
      self.registration.scope
    );

    /*
      只允许当前网站 origin。
      避免通知把用户带到外部网站。
    */
    const scopeUrl = new URL(self.registration.scope);

    if (resolved.origin !== scopeUrl.origin) {
      return fallback;
    }

    return resolved.href;

  } catch (e) {

    return fallback;

  }
}


/* ==========================================
   Receive background push
   ========================================== */

self.addEventListener('push', event => {

  let data = {};

  try {

    data = event.data
      ? event.data.json()
      : {};

  } catch (e) {

    data = {
      title: 'Price Alert',
      body: event.data
        ? event.data.text()
        : 'Your price alert has been triggered.'
    };

  }


  const title =
    data.title ||
    'Price Alert';


  const targetUrl =
    getSafeNotificationUrl(data.url);


  const options = {

    body:
      data.body ||
      'Your price alert has been triggered.',

    icon:
      data.icon ||
      './favicon.ico',

    badge:
      data.badge ||
      './favicon.ico',

    tag:
      data.tag ||
      'price-alert',

    renotify: true,

    data: {
      url: targetUrl
    }

  };


  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );

});


/* ==========================================
   User taps notification
   ========================================== */

self.addEventListener('notificationclick', event => {

  event.notification.close();


  const targetUrl =
    getSafeNotificationUrl(
      event.notification.data?.url
    );


  event.waitUntil(

    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })

    .then(async windowClients => {

      /*
        如果 Trading Platform 已经打开，
        直接把现有页面跳去 trading.html，
        然后 focus。
      */

      for (const client of windowClients) {

        if ('focus' in client) {

          try {

            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }

            return client.focus();

          } catch (e) {
            // 如果现有窗口无法 navigate，
            // 下面会打开新的窗口。
          }

        }

      }


      /*
        没有已经打开的网站窗口
        → 新开 trading.html
      */

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

    })

  );

});
