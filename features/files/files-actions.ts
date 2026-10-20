"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  duplicateFileAction as duplicateFileImpl,
  getFilePreviewUrlAction as getFilePreviewUrlImpl,
  removeFileAction as removeFileImpl,
  renameFileAction as renameFileImpl,
  undoFileRemovalAction as undoFileRemovalImpl,
} from "./actions/files-management";
import {
  finalizeAvatarUploadAction as finalizeAvatarUploadImpl,
  finalizeUploadAction as finalizeUploadImpl,
  getFileDownloadUrlAction as getFileDownloadUrlImpl,
  listTaskFilesAction as listTaskFilesImpl,
  requestAvatarUploadAction as requestAvatarUploadImpl,
  requestProjectUploadAction as requestProjectUploadImpl,
  requestTaskUploadAction as requestTaskUploadImpl,
} from "./actions/files-upload-requests";
import { getAvatarDownloadUrl, listProjectFiles } from "./files-queries";

// Reads below are called from client components after the first render.
export async function getAvatarDownloadUrlAction(input: unknown) {
  return await getAvatarDownloadUrl(input);
}

export async function listProjectFilesAction(input: unknown) {
  return await listProjectFiles(input);
}

export async function requestTaskUploadAction(input: unknown) {
  return await requestTaskUploadImpl(input);
}

export async function requestProjectUploadAction(input: unknown) {
  return await requestProjectUploadImpl(input);
}

export async function listTaskFilesAction(input: unknown) {
  return await listTaskFilesImpl(input);
}

export async function requestAvatarUploadAction(input: unknown) {
  return await requestAvatarUploadImpl(input);
}

export async function finalizeAvatarUploadAction(input: unknown) {
  return await finalizeAvatarUploadImpl(input);
}

export async function finalizeUploadAction(input: unknown) {
  return await finalizeUploadImpl(input);
}

export async function getFileDownloadUrlAction(input: unknown) {
  return await getFileDownloadUrlImpl(input);
}

export async function getFilePreviewUrlAction(input: unknown) {
  return await getFilePreviewUrlImpl(input);
}

export async function renameFileAction(input: unknown) {
  return await renameFileImpl(input);
}

export async function duplicateFileAction(input: unknown) {
  return await duplicateFileImpl(input);
}

export async function removeFileAction(input: unknown) {
  return await removeFileImpl(input);
}

export async function undoFileRemovalAction(input: unknown) {
  return await undoFileRemovalImpl(input);
}
