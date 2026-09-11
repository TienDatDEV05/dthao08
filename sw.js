const CACHE_NAME = 'doan-thao-v26';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/favicon-32.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/marked@9/marked.min.js'
];

// Install: Cache essential app shell assets and skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('PWA: Một số tài nguyên không thể lưu vào cache:', err);
      });
    })
  );
});

// Activate: Clean up all old caches immediately and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('PWA: Xóa cache cũ:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for HTML/navigation, Stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET and Supabase API requests
  if (request.method !== 'GET' || url.hostname.includes('supabase.co')) {
    return;
  }

  // For HTML navigation: Always Network-first to ensure latest updates
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html') || caches.match(request))
    );
    return;
  }

  // For static assets: Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch((err) => {
          console.debug('PWA: Offline static fetch fallback:', err.message);
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Lắng nghe sự kiện Push từ Server (Apple APNs / Google FCM) khi app ở background hoặc tắt màn hình
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: '🔔 Thông báo lịch học',
      body: event.data ? event.data.text() : 'Bạn có lịch học sắp đến!'
    };
  }

  const title = data.title || '🔔 Nhắc nhở lịch học';
  const options = {
    body: data.body || 'Bạn có tiết học sắp diễn ra!',
    icon: 'assets/icon-192.png',
    badge: 'assets/favicon-32.png',
    vibrate: [200, 100, 200],
    tag: data.tag || `dthao-push-${Date.now()}`,
    renotify: true,
    data: data.data || { url: './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Xử lý sự kiện khi người dùng click vào thông báo trên điện thoại/máy tính
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

