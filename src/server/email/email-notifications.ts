import { Effect, Layer } from "effect";

import { EmailNotifications } from "./email-contracts";
import { makeDeliverNotification } from "./email-delivery";
import { makeSendDigests } from "./email-digest";
import { getSettings, setDigest, unsubscribe } from "./email-settings";
import { MailTransport } from "./mail-transport";

export { EmailNotifications } from "./email-contracts";

export const EmailNotificationsLive = Layer.effect(
  EmailNotifications,
  Effect.map(Effect.service(MailTransport), (transport) =>
    EmailNotifications.of({
      deliverNotification: makeDeliverNotification(transport),
      getSettings,
      sendDigests: makeSendDigests(transport),
      setDigest,
      unsubscribe,
    })
  )
);
