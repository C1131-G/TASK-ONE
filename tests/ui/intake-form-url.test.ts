import { expect, it } from "bun:test";

import {
  INTAKE_PATH_PREFIX,
  intakeFormPath,
  intakeFormUrl,
  isPlausibleIntakeSlug,
} from "../../features/intake/intake-form-url";

it("builds the public form address from the origin and slug", () => {
  expect(intakeFormUrl("https://taskora.example/", "abc_DEF-123")).toBe(
    "https://taskora.example/intake/abc_DEF-123"
  );
  expect(intakeFormPath("abc")).toBe(`${INTAKE_PATH_PREFIX}abc`);
});

it("accepts only URL-safe slugs of a sensible length", () => {
  expect(isPlausibleIntakeSlug("A".repeat(22))).toBe(true);
  expect(isPlausibleIntakeSlug("abc_DEF-123456789012345")).toBe(true);
  for (const bad of [
    "",
    "short",
    "has space 1234567890123456",
    "../etc/passwd",
    "a".repeat(201),
    "<script>alert(1)</script>",
  ]) {
    expect(isPlausibleIntakeSlug(bad)).toBe(false);
  }
});
