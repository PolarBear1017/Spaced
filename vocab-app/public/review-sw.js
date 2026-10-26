/* global clients */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Show a safe default. */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Spaced · 每日複習', {
    body: data.body || '花幾分鐘複習今天的單字吧！',
    icon: '/brand/icon-192.png', badge: '/brand/icon-192.png',
    tag: data.tag || 'spaced-daily-review',
    data: { url: '/?review=daily' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      // Navigate also works if the existing page has not installed its listeners yet.
      await existing.navigate('/?review=daily');
      await existing.focus();
    } else {
      await clients.openWindow('/?review=daily');
    }
  })());
});
