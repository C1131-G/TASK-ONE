import { Effect } from "effect";
import {
  mutationOptions as tanstackMutationOptions,
  queryOptions as tanstackQueryOptions,
} from "@tanstack/react-query";

import type { AppFailure } from "@/errors";
import type { AppRuntime } from "./runtime";

// Every query and mutation in the app fails with the typed AppFailure, so
// query.error and mutation failures are narrowed without casts.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: AppFailure;
  }
}

/**
 * Binds the React layer to one runtime: queries run Effect programs through
 * runPromise (their rejection is the typed AppFailure), mutations run through
 * runPromiseExit so screens match on the Exit for rollback and Undo.
 */
export const makeBridge = (runtime: AppRuntime) => ({
  queryOptions: <A>(input: {
    readonly queryKey: readonly unknown[];
    readonly program: Effect.Effect<A, AppFailure>;
  }) =>
    tanstackQueryOptions({
      queryKey: input.queryKey,
      queryFn: () => runtime.runPromise(input.program),
    }),
  mutationOptions: <TVariables, A>(input: {
    readonly mutationKey?: readonly unknown[];
    readonly program: (variables: TVariables) => Effect.Effect<A, AppFailure>;
  }) =>
    tanstackMutationOptions({
      ...(input.mutationKey === undefined
        ? {}
        : { mutationKey: input.mutationKey }),
      mutationFn: (variables: TVariables) =>
        runtime.runPromiseExit(input.program(variables)),
    }),
});

export type Bridge = ReturnType<typeof makeBridge>;
