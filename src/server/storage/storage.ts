import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  paginateListObjectsV2,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Context, Effect, Layer } from "effect";

import { AppError } from "../core/action-result";

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
  "metsys/server/Storage"
) {}

const storageError = () =>
  new AppError({
    code: "UNAVAILABLE",
    message: "Private file storage is unavailable.",
  });

const bucket = process.env["S3_BUCKET"] ?? "metsys-private";

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
            for (const item of page.Contents ?? []) {
              if (item.Key) {
                objects.push({
                  key: item.Key,
                  lastModified: item.LastModified ?? null,
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
            { expiresIn: 300 }
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
            { expiresIn: 300 }
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
            { expiresIn: 600 }
          ),
      }),
    verifyObject: (key, contentType, sizeBytes) =>
      Effect.tryPromise({
        catch: (error) => (error instanceof AppError ? error : storageError()),
        try: async () => {
          const object = await s3.send(
            new HeadObjectCommand({ Bucket: bucket, Key: key })
          );
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
        },
      }),
  })
);
