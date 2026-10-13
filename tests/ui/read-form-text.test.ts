import { expect, test } from "bun:test";

import { readFormText } from "../../features/user/read-form-text";

test("returns the submitted text value", () => {
  const formData = new FormData();
  formData.set("email", "ada@example.test");
  expect(readFormText(formData, "email")).toBe("ada@example.test");
});

test("treats a missing field as empty text", () => {
  expect(readFormText(new FormData(), "email")).toBe("");
});

test("ignores a file submitted in place of text", () => {
  const formData = new FormData();
  formData.set("email", new File(["x"], "x.txt"));
  expect(readFormText(formData, "email")).toBe("");
});
