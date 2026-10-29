import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import type { UploadTicket } from "../storage/uploads-contracts";
import type { ClientCompanyReceipt } from "./client-company-contracts";

export const MAX_CLIENT_LOGO_BYTES = 2 * 1024 * 1024;
export const CLIENT_LOGO_PREFIX = "company/client-logos/";

export const clientLogoObjectPrefix = (companyId: string): string =>
  `${CLIENT_LOGO_PREFIX}${companyId}/`;

export const ClientLogoContentTypeSchema = Schema.Literals([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// The strict shape a logo upload must have; requests are checked against it
// on the server whatever the browser sent.
export const ClientLogoUploadSchema = Schema.Struct({
  contentType: ClientLogoContentTypeSchema,
  sizeBytes: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(MAX_CLIENT_LOGO_BYTES)
  ),
});

const VersionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(0)
);

export const RequestClientLogoUploadInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  contentType: Schema.String.check(Schema.isMaxLength(200)),
  sizeBytes: Schema.Number,
});

export const FinalizeClientLogoUploadInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  expectedVersion: VersionSchema,
  uploadIntentId: UUIDSchema,
});

export const RemoveClientLogoInputSchema = Schema.Struct({
  companyId: UUIDSchema,
  expectedVersion: VersionSchema,
});

export type RequestClientLogoUploadInput =
  typeof RequestClientLogoUploadInputSchema.Type;
export type FinalizeClientLogoUploadInput =
  typeof FinalizeClientLogoUploadInputSchema.Type;
export type RemoveClientLogoInput = typeof RemoveClientLogoInputSchema.Type;

export class ClientLogos extends Context.Service<
  ClientLogos,
  {
    readonly requestLogoUpload: (
      actorId: string,
      input: RequestClientLogoUploadInput
    ) => Effect.Effect<UploadTicket, AppError>;
    readonly finalizeLogoUpload: (
      actorId: string,
      input: FinalizeClientLogoUploadInput
    ) => Effect.Effect<ClientCompanyReceipt, AppError>;
    readonly removeLogo: (
      actorId: string,
      input: RemoveClientLogoInput
    ) => Effect.Effect<ClientCompanyReceipt, AppError>;
    // A short-lived signed URL for the company's logo, or null without one.
    // Admins may read any company's logo; a client only its own company's.
    readonly signedLogo: (
      viewerId: string,
      companyId: string
    ) => Effect.Effect<string | null, AppError>;
  }
>()("taskora/server/ClientLogos") {}
