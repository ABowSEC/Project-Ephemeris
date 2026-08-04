// Imported into the generated service worker (see workbox.importScripts in
// vite.config.js). Kept as a separate file because vite-plugin-pwa's generateSW
// strategy builds sw.js from a template — there is nowhere to put custom code
// in it, and switching to injectManifest to gain that would mean owning the
// whole precache setup by hand.
//
// Its one job: make a launch alert clickable. Notifications are posted through
// registration.showNotification (required on Android Chrome), so the click
// lands here, in the worker, not on the page that created them — the page may
// well be closed by then.

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
