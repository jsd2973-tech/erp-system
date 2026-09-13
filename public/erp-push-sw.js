/* Notifications only: do not intercept requests or cache ERP data. */
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a safe fallback. */ }
  event.waitUntil(self.registration.showNotification('태명산업개발', {
    body: '새 운행관리 알림이 있습니다. ERP에서 확인해 주세요.',
    tag: payload.id || 'dispatch-update',
    data: { url: '/?push=1' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.postMessage({ type: 'ERP_OPEN_NOTIFICATIONS' });
      await existing.focus();
    } else await self.clients.openWindow('/?push=1');
  })());
});
