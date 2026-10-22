import { expect, it } from "bun:test";

import {
  signGithubBody,
  verifyGithubSignature,
} from "../../src/server/github/github-signature";

const SECRET = "whsec_example-secret-for-signature-tests";
const encode = (text: string) => new TextEncoder().encode(text);

it("accepts the sha256 signature GitHub sends for the raw body", () => {
  const body = encode('{"action":"opened"}');
  expect(
    verifyGithubSignature(SECRET, body, signGithubBody(SECRET, body))
  ).toBe(true);
});

it("matches the documented GitHub test vector", () => {
  // From GitHub's "Validating webhook deliveries" documentation.
  const secret = "It's a Secret to Everybody";
  const body = encode("Hello, World!");
  expect(signGithubBody(secret, body)).toBe(
    "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17"
  );
});

it("signs the exact bytes, so re-serialised JSON no longer verifies", () => {
  const original = encode('{"a": 1,  "b": 2}');
  const reserialised = encode(JSON.stringify(JSON.parse('{"a": 1,  "b": 2}')));
  const signature = signGithubBody(SECRET, original);
  expect(verifyGithubSignature(SECRET, reserialised, signature)).toBe(false);
});

it("rejects a missing, malformed, wrong-length or wrong-algorithm header", () => {
  const body = encode("{}");
  const good = signGithubBody(SECRET, body);
  const hex = good.slice("sha256=".length);
  for (const header of [
    null,
    "",
    "sha256=",
    `sha1=${hex}`,
    hex,
    `sha256=${hex.slice(2)}`,
    `sha256=${hex}00`,
    `sha256=${"z".repeat(64)}`,
    `SHA256=${hex}`,
    ` ${good}`,
  ]) {
    expect(verifyGithubSignature(SECRET, body, header)).toBe(false);
  }
});

it("rejects a signature made with another secret or for another body", () => {
  const body = encode("{}");
  expect(
    verifyGithubSignature(SECRET, body, signGithubBody("other", body))
  ).toBe(false);
  expect(
    verifyGithubSignature(SECRET, encode("{ }"), signGithubBody(SECRET, body))
  ).toBe(false);
});
