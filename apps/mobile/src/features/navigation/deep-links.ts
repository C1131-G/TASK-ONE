import { Effect, Schema } from "effect";

import { NotFound } from "@/errors";

/**
 * Deep links arrive as metsys://<area>/<id>?<query> or app-scheme https
 * URLs. Everything is decoded with Schema; anything that does not fit is
 * NotFound and the caller renders the not-found screen.
 */

export const DeepLinkSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  path: Schema.Literals([
    "/bugs",
    "/bug-approvals",
    "/calendar",
    "/favorites",
    "/files",
    "/inbox",
    "/my-tasks",
    "/notifications",
    "/overview",
    "/portal",
    "/projects",
    "/settings",
    "/tasks",
  ]),
});

export type DeepLink = typeof DeepLinkSchema.Type;

const KNOWN_PATHS = new Set([
  "/bugs",
  "/bug-approvals",
  "/calendar",
  "/favorites",
  "/files",
  "/inbox",
  "/my-tasks",
  "/notifications",
  "/overview",
  "/portal",
  "/projects",
  "/settings",
  "/tasks",
]);

/** Parses an incoming URL into a typed deep link, or NotFound. */
export const parseDeepLink = (url: string): Effect.Effect<DeepLink, NotFound> =>
  Effect.flatMap(
    Effect.try({
      catch: () => new NotFound(),
      try: () => new URL(url.replace(/^metsys:\/\//u, "https://deep-link.invalid/")),
    }),
    (parsed) => {
      const rawPath = parsed.pathname.replace(/\/+$/u, "") || "/";
      if (!KNOWN_PATHS.has(rawPath)) {
        return Effect.fail(new NotFound());
      }
      const id = parsed.searchParams.get("id") ?? undefined;
      return Effect.try({
        catch: () => new NotFound(),
        try: () =>
          Schema.decodeUnknownSync(DeepLinkSchema)({
            ...(id === undefined ? {} : { id }),
            path: rawPath,
          }),
      });
    },
  );
