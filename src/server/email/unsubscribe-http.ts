import { Effect, Layer } from "effect";

import { EmailNotifications } from "./email-contracts";
import { EmailNotificationsLive } from "./email-notifications";
import { MailTransportLive } from "./mail-transport";
import { verifyUnsubscribeToken } from "./unsubscribe-token";

const PAGE_HEADERS = {
  "cache-control": "no-store",
  "content-type": "text/html; charset=utf-8",
  "referrer-policy": "no-referrer",
} as const;

const page = (status: number, heading: string, body: string): Response =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${heading}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>${heading}</h1>${body}</body></html>`,
    { headers: PAGE_HEADERS, status }
  );

const invalidLink = (): Response =>
  page(
    400,
    "This link is not valid",
    "<p>Open the unsubscribe link from a recent Metsys email, or change your email settings in Metsys.</p>"
  );

const userFromRequest = (request: Request): string | null => {
  const token = new URL(request.url).searchParams.get("token");
  const secret = process.env["BETTER_AUTH_SECRET"];
  return token && secret ? verifyUnsubscribeToken(token, secret) : null;
};

const emailLayer = Layer.provide(EmailNotificationsLive, MailTransportLive);

// A mail client or link scanner may open the link, so GET only asks to
// confirm. The change happens on POST, which is also the one-click form.
export const unsubscribePage = (request: Request): Response => {
  if (!userFromRequest(request)) {
    return invalidLink();
  }
  const action = `${new URL(request.url).pathname}${new URL(request.url).search}`;
  return page(
    200,
    "Unsubscribe from Metsys email?",
    `<p>You will stop receiving email notifications and digests. In-app notifications are not affected.</p><form method="post" action="${action.replaceAll('"', "&quot;")}"><button type="submit">Unsubscribe</button></form>`
  );
};

export const unsubscribe = async (request: Request): Promise<Response> => {
  const userId = userFromRequest(request);
  if (!userId) {
    return invalidLink();
  }
  try {
    await Effect.runPromise(
      Effect.provide(
        Effect.flatMap(Effect.service(EmailNotifications), (email) =>
          email.unsubscribe(userId)
        ),
        emailLayer
      )
    );
  } catch {
    return page(
      503,
      "Could not unsubscribe",
      "<p>Something went wrong. Try the link again in a moment.</p>"
    );
  }
  return page(
    200,
    "You are unsubscribed",
    "<p>You will no longer receive Metsys email. You can turn it back on in Settings, Notifications.</p>"
  );
};
