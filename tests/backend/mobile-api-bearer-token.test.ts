import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  personaBearerToken,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

beforeAll(setupHarness);
afterAll(teardownHarness);

it("hands the app a bearer token when a person signs in", () => {
  expect(personaBearerToken("admin")).not.toBe("");
});
