import { validateUploadInput } from "../storage/uploads-internal";
import { MAX_ATTACHMENT_BYTES } from "./intake-config";
import { fieldFailure } from "./intake-input";

export interface IntakeAttachment {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly fileName: string;
}

// Only formats the workspace can show safely: no SVG, HTML or scripts.
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
] as const;

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  signature.every((value, index) => bytes[at + index] === value);

const WEBP_TAG = [0x57, 0x45, 0x42, 0x50];
const RIFF_TAG = [0x52, 0x49, 0x46, 0x46];
const WEBP_TAG_OFFSET = 8;
const SIGNATURES: Readonly<Record<string, (bytes: Uint8Array) => boolean>> = {
  "application/pdf": (bytes) =>
    startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  "image/gif": (bytes) => startsWith(bytes, [0x47, 0x49, 0x46, 0x38]),
  "image/jpeg": (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  "image/png": (bytes) =>
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/webp": (bytes) =>
    startsWith(bytes, RIFF_TAG) && startsWith(bytes, WEBP_TAG, WEBP_TAG_OFFSET),
  "text/plain": (bytes) => {
    if (bytes.includes(0)) {
      return false;
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  },
};

const reject = (message: string) => fieldFailure("attachment", message);

// The declared type must be on the allow list and the bytes must really be
// that type; the name and size rules are the workspace's own upload rules.
export const validateAttachment = (
  attachment: IntakeAttachment
): IntakeAttachment => {
  if (attachment.bytes.byteLength < 1) {
    throw reject("The attachment is empty.");
  }
  if (attachment.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw reject("Attachments can be at most 5 MB.");
  }
  let checked: { fileName: string; contentType: string };
  try {
    checked = validateUploadInput({
      contentType: attachment.contentType,
      fileName: attachment.fileName,
      sizeBytes: attachment.bytes.byteLength,
    });
  } catch {
    throw reject("Choose a file with a valid name and type.");
  }
  const matches = SIGNATURES[checked.contentType];
  if (!matches) {
    throw reject("Attach a PNG, JPEG, WebP, GIF, PDF or text file.");
  }
  if (!matches(attachment.bytes)) {
    throw reject("The file does not match its declared type.");
  }
  return { ...attachment, ...checked };
};
