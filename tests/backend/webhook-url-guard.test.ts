import { describe, expect, it } from "bun:test";

import "./support/server-only-stub";
import {
  isBlockedAddress,
  parseWebhookUrl,
  resolvePublicTarget,
} from "../../src/server/webhooks/webhook-url-guard";

const blockedAddresses = [
  "127.0.0.1",
  "127.255.255.254",
  "10.0.0.5",
  "172.16.0.1",
  "172.31.255.255",
  "192.168.1.1",
  "169.254.169.254",
  "169.254.0.1",
  "100.64.0.1",
  "0.0.0.0",
  "192.0.0.1",
  "198.18.0.1",
  "224.0.0.1",
  "240.0.0.1",
  "255.255.255.255",
  "::1",
  "::",
  "fe80::1",
  "fc00::1",
  "fd00:ec2::254",
  "ff02::1",
  "::ffff:127.0.0.1",
  "::ffff:169.254.169.254",
  "::ffff:10.1.2.3",
  "64:ff9b::7f00:1",
  "2002:7f00:1::1",
  "not-an-address",
];

describe("isBlockedAddress", () => {
  it.each(blockedAddresses)("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700::1111"])(
    "allows the public address %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    }
  );
});

describe("parseWebhookUrl", () => {
  it("requires https in production", () => {
    expect(() =>
      parseWebhookUrl("http://example.com/hook", { production: true })
    ).toThrow();
    expect(
      parseWebhookUrl("https://example.com/hook", { production: true }).host
    ).toBe("example.com");
  });

  it("allows http outside production", () => {
    expect(
      parseWebhookUrl("http://example.com/hook", { production: false }).protocol
    ).toBe("http:");
  });

  it.each([
    "ftp://example.com/hook",
    "file:///etc/passwd",
    ["java", "script:alert(1)"].join(""),
    "https://user:pass@example.com/hook",
    "https://127.0.0.1/hook",
    "https://[::1]/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://[::ffff:7f00:1]/hook",
    "https://localhost/hook",
    "https://service.localhost/hook",
    "https://metadata.google.internal/computeMetadata/v1",
    "https://2130706433/hook",
    "https://0x7f.1/hook",
    "not a url",
  ])("rejects %s", (url) => {
    expect(() => parseWebhookUrl(url, { production: true })).toThrow();
  });
});

describe("resolvePublicTarget", () => {
  const url = new URL("https://hooks.example.com/in");

  it("returns the first public address", async () => {
    const target = await resolvePublicTarget(url, () =>
      Promise.resolve([{ address: "93.184.216.34", family: 4 }])
    );
    expect(target).toEqual({ address: "93.184.216.34", family: 4 });
  });

  it("refuses a name that resolves to a private address", async () => {
    await expect(
      resolvePublicTarget(url, () =>
        Promise.resolve([{ address: "10.0.0.8", family: 4 }])
      )
    ).rejects.toThrow();
  });

  it("refuses when any resolved address is blocked (rebinding mix)", async () => {
    await expect(
      resolvePublicTarget(url, () =>
        Promise.resolve([
          { address: "93.184.216.34", family: 4 },
          { address: "169.254.169.254", family: 4 },
        ])
      )
    ).rejects.toThrow();
  });

  it("refuses a name with no addresses", async () => {
    await expect(
      resolvePublicTarget(url, () => Promise.resolve([]))
    ).rejects.toThrow();
  });

  it("refuses when resolution fails", async () => {
    await expect(
      resolvePublicTarget(url, () => Promise.reject(new Error("ENOTFOUND")))
    ).rejects.toThrow();
  });
});
