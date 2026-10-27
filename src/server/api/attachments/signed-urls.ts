import { SIGNED_URL_SECONDS } from "../../storage/storage";
import type { UploadTicket } from "../../storage/uploads-contracts";

const MS_PER_SECOND = 1000;

// Signed links stop working on their own. The app learns when from the same
// windows the storage layer signs with.
export const expiresIn = (kind: keyof typeof SIGNED_URL_SECONDS): string =>
  new Date(Date.now() + SIGNED_URL_SECONDS[kind] * MS_PER_SECOND).toISOString();

export const withUploadExpiry = (ticket: UploadTicket) => ({
  ...ticket,
  expiresAt: expiresIn("upload"),
});
