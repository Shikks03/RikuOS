/* Service worker: displays pushes and opens the queue on tap. */

self.addEventListener("push", (event) => {
  let data = { title: "Notification", body: "", url: "/queue" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload — show the defaults rather than dropping the push
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/queue";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
