const REALTIME_REFRESHED = "metsys:realtime-refreshed";

// Tells client state that holds its own copy of server data, such as the open
// task drawer, that the server reported a change and it should read again.
// router.refresh() cannot reach that state.
export const announceRealtimeRefresh = (target: EventTarget = window): void => {
  target.dispatchEvent(new Event(REALTIME_REFRESHED));
};

export const subscribeToRealtimeRefresh = (
  listener: () => void,
  target: EventTarget = window
): (() => void) => {
  target.addEventListener(REALTIME_REFRESHED, listener);
  return () => {
    target.removeEventListener(REALTIME_REFRESHED, listener);
  };
};
