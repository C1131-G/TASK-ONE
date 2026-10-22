// A declared content type is only a claim. The first bytes of an upload say
// what it really is, so HTML or script bytes cannot pass as an image.
export const FILE_SIGNATURE_BYTES = 16;

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCodePoint(...bytes.subarray(start, start + length));

const startsWith = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((value, index) => bytes[index] === value);

const SIGNATURES: Readonly<Record<string, (bytes: Uint8Array) => boolean>> = {
  "application/pdf": (bytes) => ascii(bytes, 0, 5) === "%PDF-",
  "image/gif": (bytes) => ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6)),
  "image/jpeg": (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  "image/png": (bytes) =>
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/webp": (bytes) =>
    ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP",
  "video/mp4": (bytes) => ascii(bytes, 4, 4) === "ftyp",
};

// True when the bytes fit the declared type. Types without a known signature
// are left to the type, size and ownership checks.
export const matchesFileSignature = (
  contentType: string,
  head: Uint8Array
): boolean => {
  const matches = SIGNATURES[contentType.toLowerCase()];
  return matches ? matches(head) : true;
};
