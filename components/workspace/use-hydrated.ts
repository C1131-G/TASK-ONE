import { useSyncExternalStore } from "react";

const subscribeToHydration = (onHydrationEvent: () => void) => {
  document.addEventListener("DOMContentLoaded", onHydrationEvent);
  return () =>
    document.removeEventListener("DOMContentLoaded", onHydrationEvent);
};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export const useHydrated = () =>
  useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );
