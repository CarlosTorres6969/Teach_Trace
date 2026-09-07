// TeachTrace — Service Worker para Web Push
// Recibe notificaciones push y las muestra al usuario incluso con la app cerrada.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'TeachTrace', body: event.data.text(), url: '/student' };
  }

  const title = payload.title ?? 'TeachTrace';
  const options = {
    body: payload.body ?? '',
    icon: '/ingenieria-sistemas-unah.png',
    badge: '/ingenieria-sistemas-unah.png',
    data: { url: payload.url ?? '/student' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/student';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Si ya hay una pestaña abierta con la app, la enfoca y navega
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            return client.navigate(url);
          }
        }
        // Si no hay pestaña abierta, abre una nueva
        if (clients.openWindow) return clients.openWindow(url);
      }),
  );
});
