import { expect, test } from "bun:test";

import { scorePassword } from "../../features/user/password-score";

test("passwords under the 12-character minimum score as too short", () => {
  expect(scorePassword("Ab1!Ab1!Ab1")).toBe(0);
});

test("a minimum-length password with no variety scores as fair", () => {
  expect(scorePassword("abcdefghijkl")).toBe(1);
});

test("one extra quality lifts a password to good", () => {
  expect(scorePassword("abcdefghijk1")).toBe(2);
});

test("length, digits, symbols and mixed case score as strong", () => {
  expect(scorePassword("Correct-Horse-42!")).toBe(3);
});
