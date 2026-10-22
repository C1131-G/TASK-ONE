import { expect, it } from "bun:test";

import { compressScreenshot } from "@/features/portal/portal-screenshot-compress";
import type { Size } from "@/features/portal/portal-screenshot-geometry";

// A stand-in encoder: the file grows with the number of pixels drawn.
const encoderOf = (bytesPerPixel: number) => {
  const sizes: Size[] = [];
  const encode = (size: Size): Promise<Blob | null> => {
    sizes.push(size);
    return Promise.resolve(
      new Blob([new Uint8Array(size.width * size.height * bytesPerPixel)])
    );
  };
  return { encode, sizes };
};

it("keeps a screenshot that already fits, capped to the longest edge", async () => {
  const { encode, sizes } = encoderOf(0.01);
  const result = await compressScreenshot({
    encode,
    maxBytes: 1_000_000,
    size: { height: 2000, width: 4000 },
  });
  expect(sizes).toEqual([{ height: 960, width: 1920 }]);
  expect(result?.size).toEqual({ height: 960, width: 1920 });
  expect(result?.blob.size).toBeLessThanOrEqual(1_000_000);
});

it("steps the size down until the file is under the limit", async () => {
  const { encode, sizes } = encoderOf(1);
  const result = await compressScreenshot({
    encode,
    maxBytes: 500_000,
    size: { height: 1000, width: 1000 },
  });
  expect(sizes.length).toBeGreaterThan(1);
  expect(result?.blob.size).toBeLessThanOrEqual(500_000);
  expect(result?.size.width).toBeLessThan(1000);
});

it("gives up instead of returning a file over the limit", async () => {
  const { encode } = encoderOf(1);
  expect(
    await compressScreenshot({
      encode,
      maxBytes: 1000,
      size: { height: 1000, width: 1000 },
    })
  ).toBeNull();
});

it("gives up when the canvas cannot encode", async () => {
  expect(
    await compressScreenshot({
      encode: () => Promise.resolve(null),
      maxBytes: 1_000_000,
      size: { height: 100, width: 100 },
    })
  ).toBeNull();
});
