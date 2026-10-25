import { Schema } from "effect";

/**
 * The mobile-side route shape. It mirrors the web repo's RouteDefinition,
 * but is declared here so pending route files type against this workspace's
 * own effect copy; routes-for-client casts them into the web type at the
 * seam where the typed client is built.
 */
export interface MobileRouteDefinition {
  readonly body?: Schema.Codec<any, any, any, any>;
  readonly data: Schema.Codec<any, any, any, any>;
  readonly method: "get" | "post" | "patch" | "delete";
  readonly operationId: string;
  readonly params?: Schema.Codec<any, any, any, any>;
  readonly path: string;
  readonly query?: Schema.Codec<any, any, any, any>;
  readonly summary: string;
}
