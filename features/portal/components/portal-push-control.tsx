"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  registerPortalPushAction,
  removePortalPushAction,
} from "@/features/portal/portal-push-actions";

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

type Capability = "denied" | "ok" | "unsupported";

const unsubscribe = () => {
  // Nothing changes while the page is open, so there is nothing to release.
};
const subscribeNothing = () => unsubscribe;

const readCapability = (publicKey: string): Capability => {
  if (
    !publicKey ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return Notification.permission === "denied" ? "denied" : "ok";
};

const PortalPushControl = ({ publicKey }: { readonly publicKey: string }) => {
  const capability = useSyncExternalStore<Capability | "checking">(
    subscribeNothing,
    () => readCapability(publicKey),
    () => "checking"
  );
  const [subscribed, setSubscribed] = useState<boolean>();
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (capability !== "ok") {
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setSubscribed(existing !== null);
        }
      } catch {
        // Push is an optional enhancement; the toggle stays unavailable.
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [capability]);

  const enable = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setDenied(permission === "denied");
      setMessage("Allow notifications in your browser to turn them on.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    // The subscription is intentionally persistent so push survives navigation.
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
    const result = await registerPortalPushAction({
      endpoint: subscription.endpoint,
      idempotencyKey: crypto.randomUUID(),
      keys: { auth: keys.auth, p256dh: keys.p256dh },
      userAgent: navigator.userAgent,
    });
    if (result.ok) {
      setSubscribed(true);
      setMessage("Push notifications are on for this device.");
    } else {
      await subscription.unsubscribe();
      setMessage(result.error.message);
    }
  };

  const disable = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const result = await removePortalPushAction({
        endpoint: subscription.endpoint,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      await subscription.unsubscribe();
    }
    setSubscribed(false);
    setMessage("Push notifications are off for this device.");
  };

  const toggle = async () => {
    setPending(true);
    setMessage("");
    try {
      await (subscribed ? disable() : enable());
    } catch {
      setMessage("Push notifications could not be changed. Try again later.");
    }
    setPending(false);
  };

  if (capability === "unsupported") {
    return (
      <p className="muted">
        Push notifications are not available in this browser.
      </p>
    );
  }
  if (capability === "denied" || denied) {
    return (
      <p className="muted">
        Notifications are blocked for this site. Allow them in your browser
        settings to turn on push notifications.
      </p>
    );
  }

  return (
    <div className="portal-stack">
      <p className="muted">
        Get a notification on this device when the team replies or the status of
        one of your bugs changes.
      </p>
      <div>
        <button
          aria-pressed={subscribed === true}
          className="btn btn-secondary"
          disabled={pending || subscribed === undefined}
          onClick={toggle}
          type="button"
        >
          {subscribed
            ? "Turn off push notifications"
            : "Turn on push notifications"}
        </button>
      </div>
      <output aria-live="polite" className="hint">
        {message}
      </output>
    </div>
  );
};

export { PortalPushControl };
