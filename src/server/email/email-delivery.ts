import { Effect } from "effect";

import type { EmailNotifications } from "./email-contracts";
import {
  digestOptionOf,
  emailLinkContext,
  enabledEmailEvents,
  findActiveRecipient,
  hasDeliveryReceipt,
  mapError,
  recordDeliveryReceipt,
} from "./email-internal";
import { renderNotificationEmail } from "./email-template";
import type { MailTransportApi } from "./mail-transport";

// One instant email per notification and person. Preferences are checked again
// here because the job may run long after the notification was created.
export const makeDeliverNotification =
  (
    transport: MailTransportApi
  ): EmailNotifications["Service"]["deliverNotification"] =>
  (input) =>
    Effect.gen(function* deliverNotificationEmail() {
      const dedupeKey = `notification:${input.notificationId}:${input.userId}`;
      const recipient = yield* Effect.tryPromise({
        catch: mapError,
        try: async () => {
          if (await hasDeliveryReceipt(dedupeKey)) {
            return null;
          }
          const [person, events, digest] = await Promise.all([
            findActiveRecipient(input.userId),
            enabledEmailEvents(input.userId),
            digestOptionOf(input.userId),
          ]);
          return person && !digest && events.includes(input.eventType)
            ? person
            : null;
        },
      });
      if (!recipient) {
        return "skipped" as const;
      }
      const email = renderNotificationEmail({
        ...emailLinkContext(),
        body: input.body,
        recipientName: recipient.name,
        title: input.title,
        url: input.url,
        userId: recipient.id,
      });
      const outcome = yield* transport.send({ ...email, to: recipient.email });
      if (outcome === "sent") {
        yield* Effect.tryPromise({
          catch: mapError,
          try: () => recordDeliveryReceipt(recipient.id, dedupeKey),
        });
      }
      return outcome;
    });
