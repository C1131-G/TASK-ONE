import { Context, Effect, Layer } from "effect";

import type { AppError } from "../core/action-result";
import { StorageLive, Storage, putPrivateObject } from "../storage/storage";

export interface IntakeObjectStoreApi {
  readonly put: (
    key: string,
    contentType: string,
    bytes: Uint8Array
  ) => Effect.Effect<void, AppError>;
  readonly remove: (key: string) => Effect.Effect<void, AppError>;
}

// Where intake attachments are written. Tests replace it; production uses the
// private bucket the rest of the app stores files in.
export class IntakeObjectStore extends Context.Service<
  IntakeObjectStore,
  IntakeObjectStoreApi
>()("taskora/server/IntakeObjectStore") {}

export const IntakeObjectStoreLive = Layer.effect(
  IntakeObjectStore,
  Effect.gen(function* makeStore() {
    const storage = yield* Storage;
    return IntakeObjectStore.of({
      put: putPrivateObject,
      remove: storage.deleteObject,
    });
  })
).pipe(Layer.provide(StorageLive));
