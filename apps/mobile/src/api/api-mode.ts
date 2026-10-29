import { Layer } from "effect";

import { ALL_FIXTURES } from "@/api/mocks/all-fixtures";
import { makeMockMobileApiLayer } from "@/api/mock/mock-fetch";
import { pendingRoutes } from "@/api/pending-routes";
import { makeMobileApiLayer, type MobileApi, type TokenSource } from "@/services/mobile-api";

/**
 * "live" sends every call to the server. "hybrid" answers only the pending
 * operations (routes the server does not have yet) from fixtures, so a build
 * can show the whole UI while the backend catches up.
 */
export type ApiMode = "hybrid" | "live";

/** Anything but the exact word "hybrid" stays live, so a typo never ships mocks. */
export const resolveApiMode = (value: string | undefined): ApiMode =>
  value === "hybrid" ? "hybrid" : "live";

export const pendingOperationIds: ReadonlySet<string> = new Set(
  pendingRoutes.map((route) => route.operationId),
);

/** The MobileApi layer for a mode, talking to the server at `baseUrl`. */
export const makeApiLayer = (
  mode: ApiMode,
  baseUrl: string,
): Layer.Layer<MobileApi, never, TokenSource> =>
  mode === "live"
    ? makeMobileApiLayer({ baseUrl })
    : Layer.unwrap(
        makeMockMobileApiLayer(ALL_FIXTURES, new Set(), fetch, pendingOperationIds, baseUrl),
      );