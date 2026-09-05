import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

// Without these two lines, a new deploy installs a new service worker
// that sits idle until every open tab/instance of the app is fully
// closed — which on an installed iPhone PWA can mean never, since the
// app rarely gets truly closed. This makes every new version take
// over immediately instead.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

  const title = data.title || "Eta Omicron";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
