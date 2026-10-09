import { Effect, Layer } from "effect";

import { Storage } from "./storage";
import type { StorageApi } from "./storage";
import { makeAvatarOperations } from "./upload-avatar-operations";
import { makeUploadCleanupOperations } from "./upload-cleanup-operations";
import {
  makeFileCopyOperations,
  requestFileCopy,
} from "./upload-copy-operations";
import {
  removeFile,
  renameFile,
  undoFileRemoval,
} from "./upload-mutation-operations";
import { makeFileReadOperations } from "./upload-read-operations";
import { makeUploadRequestOperations } from "./upload-request-operations";
import { Uploads } from "./uploads-contracts";

const makeUploads = (storage: StorageApi) =>
  Uploads.of({
    ...makeAvatarOperations(storage),
    ...makeFileCopyOperations(storage),
    ...makeUploadCleanupOperations(storage),
    ...makeFileReadOperations(storage),
    ...makeUploadRequestOperations(storage),
    removeFile,
    renameFile,
    requestFileCopy,
    undoFileRemoval,
  });

export const UploadsLive = Layer.effect(
  Uploads,
  Effect.map(Effect.service(Storage), makeUploads)
);
