import { describe, expect, it } from "vitest";

import { parseColor } from "../../../../scripts/mobile-token-parser";

describe("parseColor", () => {
  it("reads a three digit hex colour as opaque", () => {
    expect(parseColor("#abc")).toEqual({ alpha: 1, blue: 0xcc, green: 0xbb, red: 0xaa });
  });

  it("reads the fourth digit of a four digit hex colour as its alpha", () => {
    const color = parseColor("#abc8");

    expect(color?.red).toBe(0xaa);
    expect(color?.alpha).toBeCloseTo(0x88 / 255, 5);
  });

  it("reads six and eight digit hex colours", () => {
    expect(parseColor("#4b5bd6")).toEqual({ alpha: 1, blue: 0xd6, green: 0x5b, red: 0x4b });
    expect(parseColor("#4b5bd680")?.alpha).toBeCloseTo(0x80 / 255, 5);
  });

  it("reads transparent and refuses text it does not know", () => {
    expect(parseColor("transparent")).toEqual({ alpha: 0, blue: 0, green: 0, red: 0 });
    expect(parseColor("not a colour")).toBeNull();
  });
});
