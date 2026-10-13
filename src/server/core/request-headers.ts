import { Effect } from "effect";
import { headers } from "next/headers";

import { AppError } from "./action-result";

// Reading headers fails outside a request scope; report it like any other outage.
export const requestHeadersOrFail = Effect.tryPromise({
  catch: () =>
    new AppError({
      code: "UNAVAILABLE",
      message: "The request could not be completed.",
    }),
  try: () => headers(),
});
