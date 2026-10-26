import { afterAll, beforeAll, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  bugRow,
  linkProjectToCompanies,
  reportBody,
  send,
  setHandlers,
} from "./support/mobile-bugs-fixtures";

beforeAll(async () => {
  await setupHarness();
  await linkProjectToCompanies();
  await setHandlers(ids.clientCompanyId, ["owner"]);
});
afterAll(teardownHarness);

const submitRoute = () => import("../../app/api/v1/portal/bugs/route");
const pickRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/pick/route");
const askRoute = () =>
  import("../../app/api/v1/workspace/bugs/[bugId]/request-info/route");
const answerRoute = () =>
  import("../../app/api/v1/portal/bugs/[bugId]/comments/route");

// A picked bug on which the handler has asked the client a question, through
// the mobile routes.
const askedBug = async (title: string): Promise<string> => {
  const { POST: submit } = await submitRoute();
  const submitted = await send(submit, "POST", "client", {
    body: reportBody(title),
  });
  const bugId = submitted.body.data.bugId as string;
  const { POST: pick } = await pickRoute();
  const picked = await send(pick, "POST", "owner", {
    body: { expectedVersion: 1, priority: "high", severity: "major" },
    params: { bugId },
  });
  const { POST: ask } = await askRoute();
  const asked = await send(ask, "POST", "owner", {
    body: {
      expectedVersion: picked.body.data.version,
      question: "Which browser?",
    },
    params: { bugId },
  });
  expect(asked.status).toBe(200);
  expect(asked.body.data.status).toBe("needs_info");
  return bugId;
};

interface BugState {
  readonly needsInfoSince: Date | null;
  readonly statusBeforeNeedsInfo: string | null;
  readonly status: string;
  readonly version: number;
}

const stateOf = async (bugId: string): Promise<BugState> => {
  const result = await authPool.query<BugState>(
    'SELECT status, version, "needsInfoSince", "statusBeforeNeedsInfo" FROM bug_report WHERE id = $1',
    [bugId]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error("bug missing");
  }
  return row;
};

const activityActions = async (bugId: string): Promise<readonly string[]> => {
  const result = await authPool.query<{ action: string }>(
    'SELECT a.action FROM activity a JOIN bug_report b ON b."taskId" = a."taskId" WHERE b.id = $1 ORDER BY a."createdAt", a.id',
    [bugId]
  );
  return result.rows.map(({ action }) => action);
};

const comments = async (bugId: string) => {
  const result = await authPool.query<{
    authorId: string;
    body: string;
    visibility: string;
  }>(
    'SELECT c."authorId", c.body, c.visibility FROM comment c JOIN bug_report b ON b."taskId" = c."taskId" WHERE b.id = $1 AND c."authorId" IN (SELECT id FROM "user" WHERE role = \'client\') ORDER BY c."createdAt", c.id',
    [bugId]
  );
  return result.rows;
};

// Characterization: the portal route and the web action share one service, so
// the answer behaves as on the web. This pins that down.
it("resumes work and records the answer when a client answers an information request", async () => {
  const bugId = await askedBug("Answer resumes");
  const before = await stateOf(bugId);
  expect(before.status).toBe("needs_info");
  const { POST } = await answerRoute();

  const reply = await send(POST, "POST", "client", {
    body: { body: "Safari 17." },
    params: { bugId },
  });

  expect(reply.status).toBe(200);
  const after = await stateOf(bugId);
  expect(after.status).toBe(before.statusBeforeNeedsInfo ?? "in_progress");
  expect(after.needsInfoSince).toBeNull();
  expect(after.version).toBeGreaterThan(before.version);
  expect(await comments(bugId)).toEqual([
    { authorId: personaId("client"), body: "Safari 17.", visibility: "public" },
  ]);
  expect(await activityActions(bugId)).toContain("comment.created");
});

it("behaves exactly like the web service for the same answer", async () => {
  const viaRoute = await askedBug("Answer via route");
  const viaService = await askedBug("Answer via service");
  const { PortalBugsLive } =
    await import("../../src/server/portal/portal-bugs");
  const { PortalBugs } =
    await import("../../src/server/portal/portal-contracts");
  const { POST } = await answerRoute();

  await send(POST, "POST", "client", {
    body: { body: "Same answer." },
    params: { bugId: viaRoute },
  });
  await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* answer() {
        const bugs = yield* PortalBugs;
        return yield* bugs.addComment(
          {
            clientCompanyId: ids.clientCompanyId,
            id: personaId("client"),
            name: "Harness client",
          },
          { body: "Same answer.", bugId: viaService }
        );
      }),
      PortalBugsLive
    )
  );

  const routeState = await stateOf(viaRoute);
  const serviceState = await stateOf(viaService);
  expect({
    needsInfoSince: routeState.needsInfoSince,
    status: routeState.status,
    version: routeState.version,
  }).toEqual({
    needsInfoSince: serviceState.needsInfoSince,
    status: serviceState.status,
    version: serviceState.version,
  });
  expect(await comments(viaRoute)).toEqual(await comments(viaService));
  expect(await activityActions(viaRoute)).toEqual(
    await activityActions(viaService)
  );
});

it("leaves an information request open when another company's client answers", async () => {
  const bugId = await askedBug("Not for B");
  const before = await stateOf(bugId);
  const { POST } = await answerRoute();

  const reply = await send(POST, "POST", "otherClient", {
    body: { body: "I am not allowed." },
    params: { bugId },
  });

  expect(reply.status).toBe(404);
  expect(await stateOf(bugId)).toEqual(before);
  expect(await comments(bugId)).toEqual([]);
  const row = await bugRow(bugId);
  expect(row.status).toBe("needs_info");
});

it("applies a retried answer once", async () => {
  const bugId = await askedBug("Answer retry");
  const { POST } = await answerRoute();
  const request = {
    body: { body: "Firefox." },
    key: "answer-retry-key",
    params: { bugId },
  };

  const first = await send(POST, "POST", "client", request);
  const retry = await send(POST, "POST", "client", request);

  expect(first.status).toBe(200);
  expect(retry.body.data.id).toBe(first.body.data.id);
  expect(await comments(bugId)).toHaveLength(1);
});
