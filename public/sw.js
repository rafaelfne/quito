const fallbackPath = "/charges";

const fallbackTitle = "Quitô";

function pushPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = pushPayload(event);
  const path = typeof payload.path === "string" && payload.path.startsWith("/") && !payload.path.startsWith("//") ? payload.path : fallbackPath;
  event.waitUntil(self.registration.showNotification(payload.title || fallbackTitle, { body: payload.body || "", data: { path } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || fallbackPath;
  event.waitUntil(self.clients.openWindow(path));
});
