export type RealtimeConnection =
  | "connecting"
  | "open"
  // The stream dropped; the browser keeps retrying on its own.
  | "disconnected"
  // The tab is hidden, so the stream is closed to save the server's work.
  | "paused"
  // The server ended the stream for good (for example too many tabs).
  | "closed";

export interface RealtimeState {
  readonly connection: RealtimeConnection;
  // Something may have changed on the server that the page has not refetched.
  readonly refreshPending: boolean;
}

export type RealtimeAction =
  | { readonly type: "opened" }
  | { readonly type: "change" }
  | { readonly type: "resync" }
  | { readonly type: "errored" }
  | { readonly type: "closed" }
  | { readonly type: "hidden" }
  | { readonly type: "visible" }
  | { readonly type: "refreshed" };

export const initialRealtimeState: RealtimeState = {
  connection: "connecting",
  refreshPending: false,
};

export const realtimeReducer = (
  state: RealtimeState,
  action: RealtimeAction
): RealtimeState => {
  if (action.type === "hidden") {
    return { ...state, connection: "paused" };
  }
  if (action.type === "visible") {
    // Whatever happened while the tab was away is caught up with one refresh.
    return state.connection === "paused"
      ? { connection: "connecting", refreshPending: true }
      : state;
  }
  if (action.type === "refreshed") {
    return { ...state, refreshPending: false };
  }
  if (state.connection === "paused" || state.connection === "closed") {
    return state;
  }
  switch (action.type) {
    case "opened": {
      return {
        connection: "open",
        refreshPending:
          state.refreshPending || state.connection === "disconnected",
      };
    }
    case "change":
    case "resync": {
      return { ...state, refreshPending: true };
    }
    case "errored": {
      return { ...state, connection: "disconnected" };
    }
    case "closed": {
      return { ...state, connection: "closed" };
    }
    default: {
      return state;
    }
  }
};

// While the stream is down the page falls back to an occasional refresh.
export const shouldPoll = (connection: RealtimeConnection): boolean =>
  connection === "disconnected" || connection === "closed";
