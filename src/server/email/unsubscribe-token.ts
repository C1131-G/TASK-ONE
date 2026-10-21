import { createHmac, timingSafeEqual } from "node:crypto";

const sign = (encodedUser: string, secret: string): Buffer =>
  createHmac("sha256", secret)
    .update(`email-unsubscribe:${encodedUser}`)
    .digest();

/** A stateless token that proves a link was issued for this user. */
export const signUnsubscribeToken = (
  userId: string,
  secret: string
): string => {
  const encodedUser = Buffer.from(userId).toString("base64url");
  return `${encodedUser}.${sign(encodedUser, secret).toString("base64url")}`;
};

/** Returns the user id when the signature matches, otherwise null. */
export const verifyUnsubscribeToken = (
  token: string,
  secret: string
): string | null => {
  const [encodedUser, encodedSignature, ...rest] = token.split(".");
  if (!encodedUser || !encodedSignature || rest.length > 0) {
    return null;
  }
  const expected = sign(encodedUser, secret);
  const actual = Buffer.from(encodedSignature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  const userId = Buffer.from(encodedUser, "base64url").toString();
  return userId.length > 0 ? userId : null;
};
