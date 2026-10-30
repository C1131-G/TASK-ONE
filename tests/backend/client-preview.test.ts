import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { PORTAL_PREVIEW_COOKIE } from "../../src/server/auth/session";
import {
  endPortalPreview,
  startPortalPreview,
} from "../../src/server/portal/portal-preview";
import type { ActionResultLike } from "./support/action-harness";
import {
  authPool,
  callAs,
  callAsWithCookie,
  ids,
  nextKey,
  personaHeaders,
  personaId,
} from "./support/action-harness";
import {
  portal,
  portalUploads,
  portalNotifications,
  portalQueries,
  previewRoute,
  installHooks,
} from "./support/client-security-fixtures";

installHooks();

const submitBug = async (title: string): Promise<string> => {
  const result = await callAs("client", portal.submitClientBugAction, {
    actualBehavior: "Broken",
    browser: null,
    description: null,
    device: null,
    expectedBehavior: "Works",
    idempotencyKey: nextKey(),
    impact: "low",
    os: null,
    pageUrl: "/page",
    projectId: ids.projectId,
    reproductionSteps: ["Open it"],
    title,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return (result.data as { bugId: string }).bugId;
};

const previewCookie = (clientId: string): string =>
  `${PORTAL_PREVIEW_COOKIE}=${encodeURIComponent(clientId)}`;

it("lets an admin read the portal as a client but never change anything", async () => {
  const bugId = await submitBug("Previewed bug");
  const cookie = previewCookie(personaId("client"));

  // Without the cookie an admin has no portal at all.
  const noCookie = await callAs("admin", portalQueries.listPortalBugs, {});
  expect(noCookie).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });

  const list = await callAsWithCookie(
    "admin",
    cookie,
    portalQueries.listPortalBugs,
    {}
  );
  expect(list.ok).toBe(true);
  expect(
    list.ok &&
      (list.data as readonly { id: string }[]).some(({ id }) => id === bugId)
  ).toBe(true);
  const detail = await callAsWithCookie(
    "admin",
    cookie,
    portalQueries.getPortalBug,
    { bugId }
  );
  expect(detail).toMatchObject({ data: { id: bugId }, ok: true });

  // Every change is refused, whatever the payload.
  const mutations: readonly (readonly [
    (input: unknown) => Promise<ActionResultLike>,
    unknown,
  ])[] = [
    [
      portal.addClientCommentAction,
      { body: "hello", bugId, idempotencyKey: nextKey() },
    ],
    [
      portal.withdrawClientBugAction,
      { bugId, expectedVersion: 1, idempotencyKey: nextKey() },
    ],
    [
      portal.confirmClientFixAction,
      { bugId, expectedVersion: 1, idempotencyKey: nextKey() },
    ],
    [portalNotifications.markAllPortalNotificationsReadAction, {}],
    [portalUploads.attachClientFileAction, { bugId, fileId: randomUUID() }],
  ];
  for (const [action, input] of mutations) {
    // eslint-disable-next-line no-await-in-loop
    const refused = await callAsWithCookie("admin", cookie, action, input);
    expect(refused).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  }
  const comments = await authPool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM comment WHERE "authorId" = $1`,
    [personaId("admin")]
  );
  expect(comments.rows[0]?.count).toBe(0);

  // Only admins can preview, and only active clients.
  const asEmployee = await callAsWithCookie(
    "owner",
    cookie,
    portalQueries.listPortalBugs,
    {}
  );
  expect(asEmployee).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  const asStaff = await callAsWithCookie(
    "admin",
    previewCookie(personaId("owner")),
    portalQueries.listPortalBugs,
    {}
  );
  expect(asStaff).toMatchObject({ ok: false });
  const nobody = await callAsWithCookie(
    "admin",
    previewCookie(randomUUID()),
    portalQueries.listPortalBugs,
    {}
  );
  expect(nobody).toMatchObject({ ok: false });
});

it("audits the start and end of a preview and refuses everyone else", async () => {
  const adminHeaders = new Headers(personaHeaders("admin"));
  adminHeaders.set("user-agent", "Admin Browser/9.0");
  await startPortalPreview(adminHeaders, personaId("client"));
  await endPortalPreview(adminHeaders, personaId("client"));
  const events = await authPool.query<{
    actorId: string;
    type: string;
    userAgent: string | null;
  }>(
    `SELECT type, "actorId", "userAgent" FROM audit_event WHERE "subjectUserId" = $1 AND type LIKE 'preview_%' ORDER BY "createdAt", id`,
    [personaId("client")]
  );
  expect(events.rows).toEqual([
    {
      actorId: personaId("admin"),
      type: "preview_started",
      userAgent: "Admin Browser/9.0",
    },
    {
      actorId: personaId("admin"),
      type: "preview_ended",
      userAgent: "Admin Browser/9.0",
    },
  ]);
  await expect(
    startPortalPreview(personaHeaders("owner"), personaId("client"))
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    startPortalPreview(personaHeaders("admin"), personaId("owner"))
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    startPortalPreview(new Headers(), personaId("client"))
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
});

const fromSite = (headers: HeadersInit, site: string): Headers => {
  const navigation = new Headers(headers);
  navigation.set("sec-fetch-site", site);
  return navigation;
};

it("starts and ends a preview through its link", async () => {
  const start = await previewRoute.GET(
    new Request(
      `http://localhost:3000/portal/preview?as=${personaId("client")}`,
      { headers: fromSite(personaHeaders("admin"), "same-origin") }
    )
  );
  expect(start.status).toBe(303);
  expect(start.headers.get("location")).toBe("http://localhost:3000/portal");
  const cookie = start.headers.get("set-cookie") ?? "";
  expect(cookie).toContain(PORTAL_PREVIEW_COOKIE);
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");

  const refused = await previewRoute.GET(
    new Request(
      `http://localhost:3000/portal/preview?as=${personaId("client")}`,
      { headers: fromSite(personaHeaders("owner"), "same-origin") }
    )
  );
  expect(refused.headers.get("location")).toBe("http://localhost:3000/");
  expect(refused.headers.get("set-cookie")).toBeNull();

  const exitHeaders = fromSite(personaHeaders("admin"), "none");
  exitHeaders.set(
    "cookie",
    `${exitHeaders.get("cookie")}; ${previewCookie(personaId("client"))}`
  );
  const exit = await previewRoute.GET(
    new Request("http://localhost:3000/portal/preview?exit=1", {
      headers: exitHeaders,
    })
  );
  expect(exit.headers.get("location")).toBe("http://localhost:3000/clients");
  expect(exit.headers.get("set-cookie")).toContain("Max-Age=0");
});

it("redirects to the configured app origin behind a reverse proxy", async () => {
  const previousBaseUrl = process.env["BETTER_AUTH_URL"];
  process.env["BETTER_AUTH_URL"] = "http://localhost:3000";

  try {
    const response = await previewRoute.GET(
      new Request(
        `http://0.0.0.0:3000/portal/preview?as=${personaId("client")}`,
        { headers: fromSite(personaHeaders("admin"), "same-origin") }
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/portal"
    );
  } finally {
    if (previousBaseUrl === undefined) {
      delete process.env["BETTER_AUTH_URL"];
    } else {
      process.env["BETTER_AUTH_URL"] = previousBaseUrl;
    }
  }
});

it("refuses to start or end a preview from a cross-site request", async () => {
  const startUrl = `http://localhost:3000/portal/preview?as=${personaId("client")}`;
  const attempts = [
    fromSite(personaHeaders("admin"), "cross-site"),
    fromSite(personaHeaders("admin"), "same-site"),
    new Headers(personaHeaders("admin")),
  ];
  const responses = await Promise.all(
    attempts.map((headers) =>
      previewRoute.GET(new Request(startUrl, { headers }))
    )
  );
  for (const response of responses) {
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(response.headers.get("set-cookie")).toBeNull();
  }

  const exitHeaders = fromSite(personaHeaders("admin"), "cross-site");
  exitHeaders.set(
    "cookie",
    `${exitHeaders.get("cookie")}; ${previewCookie(personaId("client"))}`
  );
  const exit = await previewRoute.GET(
    new Request("http://localhost:3000/portal/preview?exit=1", {
      headers: exitHeaders,
    })
  );
  expect(exit.headers.get("location")).toBe("http://localhost:3000/");
  expect(exit.headers.get("set-cookie")).toBeNull();
});
