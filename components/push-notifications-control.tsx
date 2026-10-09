"use client";

import { useEffect, useState } from "react";

import { registerPushSubscriptionAction } from "@/app/actions/notifications";

const decodeApplicationServerKey = (encoded: string): ArrayBuffer => {
  const padding = "=".repeat((4 - (encoded.length % 4)) % 4);
  const base64 = `${encoded.replaceAll("-", "+").replaceAll("_", "/")}${padding}`;
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (const [index, character] of [...binary].entries()) {
    bytes[index] = character.codePointAt(0) ?? 0;
  }
  return bytes.buffer;
};

const PushNotificationsControl = ({ publicKey }: { publicKey: string }) => {
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (
      !publicKey ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      Notification.permission === "denied"
    ) {
      return;
    }

    let cancelled = false;
    const registerForSignedInUser = async () => {
      try {
        const response = await fetch("/api/auth/get-session", {
          credentials: "same-origin",
        });
        if (!response.ok) {
          return;
        }
        const session: unknown = await response.json();
        if (session) {
          await navigator.serviceWorker.register("/sw.js");
          if (!cancelled) {
            setAvailable(true);
          }
        }
      } catch {
        // Push is an optional browser enhancement; the workspace remains usable.
      }
    };
    void registerForSignedInUser();

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const enableNotifications = async () => {
    if (!publicKey) {
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Allow notifications in your browser to enable them here.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      // This subscription is intentionally persistent so push survives component unmounts.
      // oxlint-disable-next-line react-doctor/effect-needs-cleanup
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: decodeApplicationServerKey(publicKey),
        userVisibleOnly: true,
      });
      const { keys } = subscription.toJSON();
      if (!keys?.auth || !keys.p256dh) {
        setMessage("Your browser returned an invalid push subscription.");
        return;
      }
      const result = await registerPushSubscriptionAction({
        endpoint: subscription.endpoint,
        idempotencyKey: crypto.randomUUID(),
        keys: { auth: keys.auth, p256dh: keys.p256dh },
        userAgent: navigator.userAgent,
      });
      if (result.ok) {
        setMessage("Notifications are enabled.");
      } else {
        setMessage(result.error.message);
      }
    } catch {
      setMessage("Notifications could not be enabled. Try again later.");
    }
  };

  if (!available) {
    return null;
  }

  return (
    <aside className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col items-end gap-2">
      <output aria-live="polite" className="text-sm">
        {message}
      </output>
      <button
        className="rounded-md border bg-background px-4 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={enableNotifications}
        type="button"
      >
        Enable notifications
      </button>
    </aside>
  );
};

export { PushNotificationsControl };
