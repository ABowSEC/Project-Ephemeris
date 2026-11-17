// Loaded into the generated service worker via workbox.importScripts
// (vite.config.ts), since generateSW has no place for custom code.
//
// Handles clicks on launch alerts. Those are shown via the service worker
// (required on Android), so clicks land here, not on the page.

self.addEventListener('notificationclick', (event) => {
  const url = event.notification?.data?.url;
  event.notification.close();
  if (!url) return;

  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Prefer an open tab of the app: focus it and route it to the launch,
      // rather than leaving the user with two copies of the site open.
      for (const client of clientList) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }

      await self.clients.openWindow(target);
    })()
  );
});
