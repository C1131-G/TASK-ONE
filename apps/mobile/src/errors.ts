import { Data } from "effect";

import { MobileApiError } from "@api/client";

/**
 * The typed failures the app screens match on. Every foreign call wraps its
 * rejection into one of these; defects stay defects and reach the error
 * boundary.
 */
export class Unauthenticated extends Data.TaggedError("Unauthenticated")<
  Readonly<Record<never, never>>
> {}

export class Forbidden extends Data.TaggedError("Forbidden")<
  Readonly<Record<never, never>>
> {}

export class NotFound extends Data.TaggedError("NotFound")<
  Readonly<Record<never, never>>
> {}

export class ValidationFailed extends Data.TaggedError("ValidationFailed")<{
  readonly fieldErrors: Readonly<Record<string, string>>;
}> {}

export class Conflict extends Data.TaggedError("Conflict")<{
  readonly currentVersion?: number | undefined;
}> {}

export class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly retryAfter?: number | undefined;
}> {}

export class Unavailable extends Data.TaggedError("Unavailable")<{
  readonly requestId: string;
}> {}

export class Offline extends Data.TaggedError("Offline")<
  Readonly<Record<never, never>>
> {}

export class StorageFailure extends Data.TaggedError("StorageFailure")<{
  readonly cause?: unknown;
}> {}

export class DecodeFailure extends Data.TaggedError("DecodeFailure")<{
  readonly cause?: unknown;
}> {}

export type AppFailure =
  | Unauthenticated
  | Forbidden
  | NotFound
  | ValidationFailed
  | Conflict
  | RateLimited
  | Unavailable
  | Offline
  | StorageFailure
  | DecodeFailure;

/** Maps the API client's error (or any foreign rejection) into the app's typed failures. */
export const fromMobileApiError = (error: unknown): AppFailure => {
  if (!(error instanceof MobileApiError)) {
    return new Unavailable({ requestId: "" });
  }

  switch (error.code) {
    case "CONFLICT":
      return new Conflict({ currentVersion: undefined });
    case "FORBIDDEN":
      return new Forbidden();
    case "NOT_FOUND":
      return new NotFound();
    case "RATE_LIMITED":
      return new RateLimited({ retryAfter: undefined });
    case "UNAUTHENTICATED":
      return new Unauthenticated();
    case "UNAVAILABLE":
      return new Unavailable({ requestId: error.requestId });
    case "VALIDATION_FAILED":
      return new ValidationFailed({ fieldErrors: error.fieldErrors ?? {} });
  }
};
