import { afterAll, beforeAll, expect, it } from "bun:test";

import { collectViolations, entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import {
  ids,
  nextKey,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { ActionResultLike } from "./support/action-harness";

const portal = await import("../../features/portal/portal-actions");
const portalQueries = await import("../../features/portal/portal-queries");
const portalPush = await import("../../features/portal/portal-push-actions");

beforeAll(setupHarness);
afterAll(teardownHarness);

const bug = () => ({ bugId: ids.random });
const bugFields = () => ({
  actualBehavior: "Broken",
  browser: null,
  description: null,
  device: null,
  expectedBehavior: "Works",
  impact: "low",
  os: null,
  pageUrl: "/settings",
  reproductionSteps: ["Open"],
  title: "Permission bug",
});

const portalActions: readonly ActionEntry[] = [
  entry("listPortalProjects", portalQueries.listPortalProjects, () => ({})),
  entry("listPortalBugs", portalQueries.listPortalBugs, () => ({})),
  entry("getPortalBug", portalQueries.getPortalBug, bug),
  entry(
    "listPortalNotifications",
    portalQueries.listPortalNotifications,
    () => ({})
  ),
  entry("submitClientBugAction", portal.submitClientBugAction, () => ({
    ...bugFields(),
    idempotencyKey: nextKey(),
    projectId: ids.projectId,
  })),
  entry("editClientBugAction", portal.editClientBugAction, () => ({
    ...bugFields(),
    ...bug(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
  })),
  entry("withdrawClientBugAction", portal.withdrawClientBugAction, () => ({
    ...bug(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
  })),
  entry("confirmClientFixAction", portal.confirmClientFixAction, () => ({
    ...bug(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
  })),
  entry("reopenClientFixAction", portal.reopenClientFixAction, () => ({
    ...bug(),
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    reason: "Still broken",
  })),
  entry("rateClientBugAction", portal.rateClientBugAction, () => ({
    ...bug(),
    idempotencyKey: nextKey(),
    satisfaction: "up",
  })),
  entry("addClientCommentAction", portal.addClientCommentAction, () => ({
    ...bug(),
    body: "Hello",
    idempotencyKey: nextKey(),
  })),
  entry("requestPortalUploadAction", portal.requestPortalUploadAction, () => ({
    ...bug(),
    contentType: "image/png",
    fileName: "a.png",
    sizeBytes: 10,
  })),
  entry(
    "finalizePortalUploadAction",
    portal.finalizePortalUploadAction,
    () => ({
      ...bug(),
      idempotencyKey: nextKey(),
      uploadIntentId: ids.random,
    })
  ),
  entry("attachClientFileAction", portal.attachClientFileAction, () => ({
    ...bug(),
    fileId: ids.random,
  })),
  entry("getPortalFileUrlAction", portal.getPortalFileUrlAction, () => ({
    disposition: "download",
    fileId: ids.random,
  })),
  entry(
    "markPortalNotificationReadAction",
    portal.markPortalNotificationReadAction,
    () => ({ notificationId: ids.random })
  ),
  entry(
    "markAllPortalNotificationsReadAction",
    portal.markAllPortalNotificationsReadAction,
    () => ({})
  ),
  entry(
    "registerPortalPushAction",
    portalPush.registerPortalPushAction,
    () => ({
      endpoint: "https://push.example/endpoint",
      idempotencyKey: nextKey(),
      keys: { auth: "a", p256dh: "b" },
      userAgent: null,
    })
  ),
  entry("removePortalPushAction", portalPush.removePortalPushAction, () => ({
    endpoint: "https://push.example/endpoint",
    idempotencyKey: nextKey(),
  })),
];

const refusedWith =
  (...codes: string[]) =>
  (result: ActionResultLike): boolean =>
    !result.ok && codes.includes(result.error.code);

it("covers every portal action and query", () => {
  const exported = [
    ...Object.keys(portal),
    ...Object.keys(portalQueries),
    ...Object.keys(portalPush),
  ];
  const covered = new Set(portalActions.map(({ name }) => name));
  expect(exported.filter((name) => !covered.has(name))).toEqual([]);
});

it("refuses anonymous visitors on every portal action", async () => {
  expect(
    await collectViolations(
      "anonymous",
      portalActions,
      refusedWith("UNAUTHENTICATED")
    )
  ).toEqual([]);
});

it("refuses employees and administrators on every portal action", async () => {
  for (const persona of ["owner", "admin"] as const) {
    // Sequential: personas share the mocked request headers.
    // eslint-disable-next-line no-await-in-loop
    const violations = await collectViolations(
      persona,
      portalActions,
      refusedWith("FORBIDDEN")
    );
    expect(violations).toEqual([]);
  }
});

it("refuses deactivated accounts and accounts that must change their password", async () => {
  expect(
    await collectViolations(
      "deactivated",
      portalActions,
      refusedWith("UNAUTHENTICATED")
    )
  ).toEqual([]);
  expect(
    await collectViolations("forced", portalActions, refusedWith("FORBIDDEN"))
  ).toEqual([]);
});
