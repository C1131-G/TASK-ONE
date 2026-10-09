self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let message;
  try {
    message = event.data.json();
  } catch {
    return;
  }

  const title =
    typeof message.title === "string" ? message.title : "Metsys update";
  const options = {
    body: typeof message.body === "string" ? message.body : "",
    data: { url: message.url },
    tag: typeof message.tag === "string" ? message.tag : "metsys-update",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url;
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return;
  }

  const target = new URL(path, self.location.origin);
  if (target.origin !== self.location.origin) {
    return;
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      const existingClient = clients.find(
        (client) =>
          client.url.startsWith(self.location.origin) && "focus" in client
      );
      if (existingClient) {
        await existingClient.navigate(target.href);
        await existingClient.focus();
        return;
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
