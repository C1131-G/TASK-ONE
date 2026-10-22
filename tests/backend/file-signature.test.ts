import { expect, it } from "bun:test";

import { matchesFileSignature } from "../../src/server/storage/file-signature";

const encode = (text: string): number[] => [...new TextEncoder().encode(text)];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const HTML = encode("<html><script>alert(1)</script>");

it("accepts bytes that match the declared image type", () => {
  expect(matchesFileSignature("image/png", Uint8Array.from(PNG))).toBe(true);
});

it("rejects HTML or script bytes declared as an image", () => {
  expect(matchesFileSignature("image/png", Uint8Array.from(HTML))).toBe(false);
  expect(matchesFileSignature("image/jpeg", Uint8Array.from(PNG))).toBe(false);
});

it("checks WebP, GIF, PDF and MP4 containers", () => {
  const webp = [...encode("RIFF"), 1, 2, 3, 4, ...encode("WEBP")];
  expect(matchesFileSignature("image/webp", Uint8Array.from(webp))).toBe(true);
  expect(
    matchesFileSignature(
      "image/webp",
      Uint8Array.from([...encode("RIFF"), 1, 2, 3, 4, ...encode("WAVE")])
    )
  ).toBe(false);
  expect(
    matchesFileSignature("image/gif", Uint8Array.from(encode("GIF89a")))
  ).toBe(true);
  expect(
    matchesFileSignature("application/pdf", Uint8Array.from(encode("%PDF-1.7")))
  ).toBe(true);
  const mp4 = [0, 0, 0, 0x18, ...encode("ftypisom")];
  expect(matchesFileSignature("video/mp4", Uint8Array.from(mp4))).toBe(true);
  expect(matchesFileSignature("video/mp4", Uint8Array.from(PNG))).toBe(false);
});

it("leaves types without a known signature to the other checks", () => {
  expect(matchesFileSignature("text/plain", Uint8Array.from(HTML))).toBe(true);
});
