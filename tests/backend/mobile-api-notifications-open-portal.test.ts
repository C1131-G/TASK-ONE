import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  ids,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { OpenFixture } from "./support/mobile-notifications-fixtures";
import {
  callRoute,
  seedNotification,
  seedOpenFixture,
} from "./support/mobile-notifications-fixtures";

let fixture: OpenFixture;

beforeAll(async () => {
  await setupHarness();
  fixture = await seedOpenFixture(
    ids.clientCompanyId,
    ids.otherClientCompanyId,
    personaId("owner")
  );
});

afterAll(teardownHarness);

interface Opened {
  id: string;
  summary: { status: string; title: string };
  type: string;
}

const open = async (token: string, id: string) => {
  const { GET } =
    await import("../../apps/web/app/api/v1/portal/notifications/[id]/target/route");
  return callRoute<Opened>(
    GET,
    "GET",
    `/api/v1/portal/notifications/${id}/target`,
    { params: { id }, token }
  );
};

it("opens the bug a client's notification points at, with its title and status", async () => {
  const id = await seedNotification({
    targetId: fixture.bugId,
    targetType: "bug",
    userId: personaId("client"),
  });

  const reply = await open(personaBearerToken("client"), id);

  expect(reply.status).toBe(200);
  expect(reply.body.data).toEqual({
    id: fixture.bugId,
    summary: { status: expect.any(String), title: expect.any(String) },
    type: "bug",
  });
});
