"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  finalizeAvatarUploadAction as finalizeAvatar,
  finalizeUploadAction as finalizeUpload,
  getAvatarDownloadUrlAction as getAvatarUrl,
  getFileDownloadUrlAction as getFileUrl,
  listProjectFilesAction as listProjectFiles,
  listTaskFilesAction as listTaskFiles,
  requestAvatarUploadAction as requestAvatarUpload,
  requestProjectUploadAction as requestProjectUpload,
  requestTaskUploadAction as requestTaskUpload,
} from "./uploads-part-1";
import {
  duplicateFileAction as duplicateFile,
  getFilePreviewUrlAction as getFilePreviewUrl,
  removeFileAction as removeFile,
  renameFileAction as renameFile,
  undoFileRemovalAction as undoFileRemoval,
} from "./uploads-part-2";

export async function requestTaskUploadAction(input: unknown) {
  return await requestTaskUpload(input);
}

export async function requestProjectUploadAction(input: unknown) {
  return await requestProjectUpload(input);
}

export async function listProjectFilesAction(input: unknown) {
  return await listProjectFiles(input);
}

export async function listTaskFilesAction(input: unknown) {
  return await listTaskFiles(input);
}

export async function requestAvatarUploadAction(input: unknown) {
  return await requestAvatarUpload(input);
}

export async function finalizeAvatarUploadAction(input: unknown) {
  return await finalizeAvatar(input);
}

export async function getAvatarDownloadUrlAction(input: unknown) {
  return await getAvatarUrl(input);
}

export async function finalizeUploadAction(input: unknown) {
  return await finalizeUpload(input);
}

export async function getFileDownloadUrlAction(input: unknown) {
  return await getFileUrl(input);
}

export async function getFilePreviewUrlAction(input: unknown) {
  return await getFilePreviewUrl(input);
}

export async function renameFileAction(input: unknown) {
  return await renameFile(input);
}

export async function duplicateFileAction(input: unknown) {
  return await duplicateFile(input);
}

export async function removeFileAction(input: unknown) {
  return await removeFile(input);
}

export async function undoFileRemovalAction(input: unknown) {
  return await undoFileRemoval(input);
}
