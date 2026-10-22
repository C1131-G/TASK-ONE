import "server-only";
import { Effect } from "effect";
import { notFound } from "next/navigation";

import { issueFormTokenFor } from "@/src/server/intake/intake-config";
import { IntakeRuntimeLive } from "@/src/server/intake/intake-http";
import { IntakeSubmissions } from "@/src/server/intake/intake-submissions";

// Public by design: the unguessable slug in the URL is the only credential,
// and the visitor has no session. This module is deliberately not a Server
// Action file, so nothing here is callable from the browser; the submit path is
// POST /api/intake/[slug], covered by tests/backend/intake-routes.test.ts.

// An unknown slug and a disabled form are the same missing page.
export const getPublicIntakeForm = async (slug: string) => {
  const outcome = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* describe() {
        return yield* (yield* IntakeSubmissions).describeForm(slug);
      }).pipe(
        Effect.match({
          onFailure: (error) => ({ error, ok: false as const }),
          onSuccess: (form) => ({ form, ok: true as const }),
        })
      ),
      IntakeRuntimeLive
    )
  );
  if (!outcome.ok) {
    if (outcome.error.code === "NOT_FOUND") {
      notFound();
    }
    throw new Error("The intake form could not be loaded.");
  }
  return outcome.form;
};

// Signs the moment the form was served so a too-fast submission is refused.
// Call after the request is known to be dynamic (it reads the clock).
export const issueIntakeFormToken = (slug: string): string =>
  issueFormTokenFor(slug, Date.now());
