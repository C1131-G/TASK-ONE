import "server-only";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  paginateListObjectsV2,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Context, Effect, Layer } from "effect";

import { AppError } from "../core/action-result";
import { FILE_SIGNATURE_BYTES, matchesFileSignature } from "./file-signature";

export interface StorageApi {
  readonly listObjects?: (
    prefix: string
  ) => Effect.Effect<
    readonly { readonly key: string; readonly lastModified: Date | null }[],
    AppError
  >;
  readonly signUpload: (
    key: string,
    contentType: string,
    sizeBytes: number
  ) => Effect.Effect<string, AppError>;
  readonly verifyObject: (
    key: string,
    contentType: string,
    sizeBytes: number
  ) => Effect.Effect<void, AppError>;
  readonly signDownload: (
    key: string,
    fileName: string
  ) => Effect.Effect<string, AppError>;
  readonly signPreview: (
    key: string,
    contentType: string
  ) => Effect.Effect<string, AppError>;
  readonly deleteObject: (key: string) => Effect.Effect<void, AppError>;
  readonly copyObject: (
    sourceKey: string,
    destinationKey: string
  ) => Effect.Effect<void, AppError>;
}

export class Storage extends Context.Service<Storage, StorageApi>()(
  "taskora/server/Storage"
) {}

const storageError = () =>
  new AppError({
    code: "UNAVAILABLE",
    message: "Private file storage is unavailable.",
  });

// Storage answers 404 for a key that was never written.
const isMissingObject = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "$metadata" in error &&
  (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404;

const objectNotUploaded = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    message: "The file has not been uploaded yet.",
  });

// How long each kind of signed URL works, in seconds. The mobile API reports the
// same windows, so both read them from here.
export const SIGNED_URL_SECONDS = {
  download: 300,
  preview: 300,
  upload: 600,
} as const;

const bucket = process.env["S3_BUCKET"] ?? "taskora-private";

const endpoint = process.env["S3_ENDPOINT"];
const publicEndpoint = process.env["S3_PUBLIC_ENDPOINT"] ?? endpoint;
const accessKeyId = process.env["S3_ACCESS_KEY_ID"];
const secretAccessKey = process.env["S3_SECRET_ACCESS_KEY"];
if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
  throw new Error(
    "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together."
  );
}

const createS3Client = (clientEndpoint?: string): S3Client =>
  new S3Client({
    region: process.env["S3_REGION"] ?? "us-east-1",
    ...(clientEndpoint
      ? { endpoint: clientEndpoint, forcePathStyle: true }
      : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
const s3 = createS3Client(endpoint);
const signingS3 =
  publicEndpoint === endpoint ? s3 : createS3Client(publicEndpoint);

// The bucket name has a default, so storage counts as configured only when an
// endpoint, credentials or an explicit bucket is set.
export const isStorageConfigured = Boolean(
  endpoint || accessKeyId || process.env["S3_BUCKET"]
);

/** Readiness probe: confirms the private bucket exists and is reachable. */
export const probeStorageBucket = async (
  signal: AbortSignal
): Promise<void> => {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }), {
    abortSignal: signal,
  });
};

const encodeDispositionFileName = (fileName: string): string => {
  const sanitized = [...fileName]
    .map((character) =>
      character === "\r" ||
      character === "\n" ||
      character === '"' ||
      character === "\\"
        ? "_"
        : character
    )
    .join("");
  return encodeURIComponent(sanitized).replaceAll("'", "%27");
};

const encodeObjectKey = (key: string): string =>
  key.split("/").map(encodeURIComponent).join("/");

export const StorageLive = Layer.succeed(
  Storage,
  Storage.of({
    copyObject: (sourceKey, destinationKey) =>
      Effect.tryPromise({
        catch: storageError,
        try: async () => {
          await s3.send(
            new CopyObjectCommand({
              Bucket: bucket,
              CopySource: `${bucket}/${encodeObjectKey(sourceKey)}`,
              Key: destinationKey,
              MetadataDirective: "COPY",
            })
          );
        },
      }),
    deleteObject: (key) =>
      Effect.tryPromise({
        catch: storageError,
        try: async () => {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        },
      }),
    listObjects: (prefix) =>
      Effect.tryPromise({
        catch: storageError,
        try: async () => {
          const objects: { key: string; lastModified: Date | null }[] = [];
          for await (const page of paginateListObjectsV2(
            { client: s3, pageSize: 1000 },
            { Bucket: bucket, Prefix: prefix }
          )) {
            for (const listedObject of page.Contents ?? []) {
              if (listedObject.Key) {
                objects.push({
                  key: listedObject.Key,
                  lastModified: listedObject.LastModified ?? null,
                });
              }
            }
          }
          return objects;
        },
      }),
    signDownload: (key, fileName) =>
      Effect.tryPromise({
        catch: storageError,
        try: () =>
          getSignedUrl(
            signingS3,
            new GetObjectCommand({
              Bucket: bucket,
              Key: key,
              ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeDispositionFileName(fileName)}`,
              ResponseContentType: "application/octet-stream",
            }),
            { expiresIn: SIGNED_URL_SECONDS.download }
          ),
      }),
    signPreview: (key, contentType) =>
      Effect.tryPromise({
        catch: storageError,
        try: () =>
          getSignedUrl(
            signingS3,
            new GetObjectCommand({
              Bucket: bucket,
              Key: key,
              ResponseContentDisposition: "inline",
              ResponseContentType: contentType,
            }),
            { expiresIn: SIGNED_URL_SECONDS.preview }
          ),
      }),
    signUpload: (key, contentType, sizeBytes) =>
      Effect.tryPromise({
        catch: storageError,
        try: () =>
          getSignedUrl(
            signingS3,
            new PutObjectCommand({
              Bucket: bucket,
              ContentLength: sizeBytes,
              ContentType: contentType,
              IfNoneMatch: "*",
              Key: key,
            }),
            { expiresIn: SIGNED_URL_SECONDS.upload }
          ),
      }),
    verifyObject: (key, contentType, sizeBytes) =>
      Effect.tryPromise({
        catch: (error) => (error instanceof AppError ? error : storageError()),
        try: async () => {
          const object = await s3
            .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
            .catch((error: unknown) => {
              throw isMissingObject(error) ? objectNotUploaded() : error;
            });
          if (
            object.ContentLength !== sizeBytes ||
            object.ContentType?.split(";")[0]?.trim().toLowerCase() !==
              contentType.toLowerCase()
          ) {
            throw new AppError({
              code: "VALIDATION_FAILED",
              message: "The uploaded file does not match its upload request.",
            });
          }
          const head = await s3.send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: key,
              Range: `bytes=0-${FILE_SIGNATURE_BYTES - 1}`,
            })
          );
          const bytes =
            (await head.Body?.transformToByteArray()) ?? new Uint8Array();
          if (!matchesFileSignature(contentType, bytes)) {
            throw new AppError({
              code: "VALIDATION_FAILED",
              message: "The uploaded file is not the type it was declared as.",
            });
          }
        },
      }),
  })
);

// Server-side writes for callers that have no browser to hand a signed URL to,
// such as the public intake form. The object is private like every other.
export const putPrivateObject = (
  key: string,
  contentType: string,
  body: Uint8Array
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: storageError,
    try: async () => {
      await s3.send(
        new PutObjectCommand({
          Body: body,
          Bucket: bucket,
          ContentLength: body.byteLength,
          ContentType: contentType,
          IfNoneMatch: "*",
          Key: key,
        })
      );
    },
  });
