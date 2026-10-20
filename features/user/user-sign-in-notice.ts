const INACTIVITY_NOTICE =
  "Signed out for inactivity. You were idle for 2 hours; sign in again to continue.";

// Turns /login?reason= into the notice the sign-in form shows; any other value
// shows none.
export const parseSignInNotice = (
  reason: string | string[] | undefined
): string => {
  const value = Array.isArray(reason) ? reason[0] : reason;
  return value === "inactivity" ? INACTIVITY_NOTICE : "";
};
