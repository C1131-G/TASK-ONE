import { Effect, Layer } from "effect";

import { PushNotifications } from "./push-contracts";
import { makeDeliver } from "./push-delivery";
import { register, unregister } from "./push-subscriptions";
import { PushTransport } from "./push-transport";

export {
  KeysSchema,
  PushInputSchema,
  PushNotifications,
} from "./push-contracts";
export type { DeliveryResult, PushInput } from "./push-contracts";

export const PushNotificationsLive = Layer.effect(
  PushNotifications,
  Effect.map(Effect.service(PushTransport), (transport) =>
    PushNotifications.of({
      deliver: makeDeliver(transport),
      register,
      unregister,
    })
  )
);
