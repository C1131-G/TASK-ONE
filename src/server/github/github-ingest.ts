import { randomUUID } from "node:crypto";

import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { decryptSecret, webhookKeyMaterial } from "../webhooks/webhook-secret";
import { normalizeRepoFullName } from "./github-contracts";
import {
  claimedRepository,
  decodePullEvent,
  isHandledAction,
} from "./github-payload";
import { syncPull } from "./github-pull-sync";
import { verifyGithubSignature } from "./github-signature";

export interface GithubDeliveryRequest {
  readonly rawBody: Uint8Array;
  readonly signature: string | null;
  readonly event: string | null;
  readonly deliveryId: string | null;
}

export type GithubIngestOutcome =
  | { readonly status: "rejected" }
  | { readonly status: "bad_request" }
  | { readonly status: "pong" }
  | { readonly status: "ignored" }
  | { readonly status: "duplicate" }
  | {
      readonly status: "processed";
      readonly linked: number;
      readonly completed: number;
    };

const MAX_DELIVERY_ID_LENGTH = 100;
const DELIVERY_ID_PATTERN = /^[A-Za-z0-9._:-]+$/u;
// Checked against when no connection matches, so an unknown repository costs
// about as much as a wrong signature and answers the same way.
const DECOY_SECRET = "whsec_decoy-for-unknown-repositories";

const parseJson = (rawBody: Uint8Array): unknown => {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(rawBody)
    );
  } catch {
    return null;
  }
};

const isDeliveryId = (value: string | null): value is string =>
  value !== null &&
  value.length > 0 &&
  value.length <= MAX_DELIVERY_ID_LENGTH &&
  DELIVERY_ID_PATTERN.test(value);

const receive = async (
  request: GithubDeliveryRequest
): Promise<GithubIngestOutcome> => {
  const payload = parseJson(request.rawBody);
  const repository = claimedRepository(payload);
  if (!repository) {
    return { status: "bad_request" };
  }
  const connection = await db.orm.public.GithubConnection.where({
    repoFullName: normalizeRepoFullName(repository),
  }).first();
  const active = connection?.enabled ? connection : undefined;
  const secret = active
    ? decryptSecret(active.secretCiphertext, webhookKeyMaterial())
    : DECOY_SECRET;
  const verified = verifyGithubSignature(
    secret,
    request.rawBody,
    request.signature
  );
  if (!active || !verified) {
    return { status: "rejected" };
  }
  if (!isDeliveryId(request.deliveryId) || !request.event) {
    return { status: "bad_request" };
  }
  if (request.event === "ping") {
    return { status: "pong" };
  }
  const action =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)["action"]
      : undefined;
  if (request.event !== "pull_request" || !isHandledAction(action)) {
    return { status: "ignored" };
  }
  const event = decodePullEvent(payload);
  if (!event) {
    return { status: "bad_request" };
  }
  const { deliveryId } = request;
  const now = new Date();
  try {
    return await db.transaction(async (transaction) => {
      const seen = await transaction.orm.public.GithubDelivery.where({
        connectionId: active.id,
        deliveryId,
      })
        .select("id")
        .first();
      if (seen) {
        return { status: "duplicate" } as const;
      }
      await transaction.orm.public.GithubDelivery.create({
        connectionId: active.id,
        createdAt: now,
        deliveryId,
        event: request.event ?? "pull_request",
        id: randomUUID(),
      });
      const outcome = await syncPull(transaction, active, event, now);
      return { status: "processed", ...outcome } as const;
    });
  } catch (error) {
    // A concurrent copy of the same delivery claimed the id first.
    if (isUniqueConstraintViolation(error)) {
      return { status: "duplicate" };
    }
    throw error;
  }
};

export class GithubIngest extends Context.Service<
  GithubIngest,
  {
    readonly receive: (
      request: GithubDeliveryRequest
    ) => Effect.Effect<GithubIngestOutcome, AppError>;
  }
>()("taskora/server/GithubIngest") {}

export const GithubIngestLive = Layer.succeed(
  GithubIngest,
  GithubIngest.of({
    receive: (request) =>
      Effect.tryPromise({
        catch: () =>
          new AppError({
            code: "UNAVAILABLE",
            message: "The delivery could not be processed.",
          }),
        try: () => receive(request),
      }),
  })
);
