import "server-only";
import { Effect, Schema } from "effect";
import { cache } from "react";

import { HIDDEN_RECORD_CODES, readRecordOrNotFound } from "@/lib/read-result";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { Notifications } from "@/src/server/notifications/service";
import {
  PortalBugDetailSchema,
  PortalBugListSchema,
  PortalBugs,
  PortalNotificationListSchema,
  PortalProjectSchema,
  PortalResponseTimesSchema,
} from "@/src/server/portal/portal-contracts";
import {
  ClientBugIdInputSchema,
  ListCompanyBugsInputSchema,
} from "@/src/server/portal/portal-input-contracts";
import {
  PortalProjects,
  PortalSharedProjectDetailSchema,
  PortalSharedProjectInputSchema,
  PortalSharedProjectListSchema,
} from "@/src/server/portal/portal-project-contracts";
import { Uploads } from "@/src/server/storage/uploads-contracts";

import { runPortalAction, toPortalActor } from "./portal-action-runner";

export const listPortalProjects = async (input: unknown) =>
  await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* listPortalProjectsProgram() {
        const bugs = yield* PortalBugs;
        return yield* bugs.listProjects(toPortalActor(user));
      }),
    Schema.Array(PortalProjectSchema),
    { preview: true }
  );

// Projects shared with the signed-in client's company, read only.
export const listPortalSharedProjects = async (input: unknown) =>
  await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* listPortalSharedProjectsProgram() {
        const projects = yield* PortalProjects;
        return yield* projects.listSharedProjects(toPortalActor(user));
      }),
    PortalSharedProjectListSchema,
    { preview: true }
  );

export const getPortalSharedProject = async (input: unknown) =>
  await runPortalAction(
    input,
    PortalSharedProjectInputSchema,
    (user, validated) =>
      Effect.gen(function* getPortalSharedProjectProgram() {
        const projects = yield* PortalProjects;
        return yield* projects.getSharedProject(
          toPortalActor(user),
          validated.projectId
        );
      }),
    PortalSharedProjectDetailSchema,
    { preview: true }
  );

// Keyed by id so page metadata and the page body share one fetch per request.
export const getPortalSharedProjectById = cache(
  async (projectId: string) => await getPortalSharedProject({ projectId })
);

// The portal project page's record. A project the company may not see reads
// as missing so its existence is never confirmed.
export const getPortalSharedProjectRecord = async (projectId: string) =>
  readRecordOrNotFound(
    await getPortalSharedProjectById(projectId),
    "This project",
    HIDDEN_RECORD_CODES
  );

export const listPortalBugs = async (input: unknown) =>
  await runPortalAction(
    input,
    ListCompanyBugsInputSchema,
    (user, validated) =>
      Effect.gen(function* listPortalBugsProgram() {
        const bugs = yield* PortalBugs;
        return yield* bugs.listBugs(toPortalActor(user), validated);
      }),
    PortalBugListSchema,
    { preview: true }
  );

export const getPortalBug = async (input: unknown) =>
  await runPortalAction(
    input,
    ClientBugIdInputSchema,
    (user, validated) =>
      Effect.gen(function* getPortalBugProgram() {
        const bugs = yield* PortalBugs;
        return yield* bugs.getBug(toPortalActor(user), validated.bugId);
      }),
    PortalBugDetailSchema,
    { preview: true }
  );

// Keyed by id so page metadata and the page body share one fetch per request.
export const getPortalBugById = cache(
  async (bugId: string) => await getPortalBug({ bugId })
);

export const listPortalNotifications = async (input: unknown) =>
  await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* listPortalNotificationsProgram() {
        const bugs = yield* PortalBugs;
        return yield* bugs.listNotifications(toPortalActor(user));
      }),
    PortalNotificationListSchema,
    { preview: true }
  );

export const getPortalResponseTimes = async (input: unknown) =>
  await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* getPortalResponseTimesProgram() {
        const bugs = yield* PortalBugs;
        return yield* bugs.responseTimes(toPortalActor(user));
      }),
    PortalResponseTimesSchema,
    { preview: true }
  );

// The portal bug page's record. Another company's bug reads as missing so its
// existence is never confirmed.
export const getPortalBugRecord = async (bugId: string) =>
  readRecordOrNotFound(
    await getPortalBugById(bugId),
    "This bug",
    HIDDEN_RECORD_CODES
  );

// Signs an image attachment's preview while the page renders, so the card
// shows the image without a client round trip.
export const getPortalFilePreviewUrl = async (fileId: string) =>
  await runPortalAction(
    { fileId },
    Schema.Struct({ fileId: UUIDSchema }),
    (user, validated) =>
      Effect.gen(function* getPortalFilePreviewUrlProgram() {
        const uploads = yield* Uploads;
        return yield* uploads.signedPreview(user.id, validated.fileId);
      }),
    Schema.String,
    { preview: true }
  );

export const getPortalEmailUpdates = async (input: unknown) =>
  await runPortalAction(
    input,
    Schema.Struct({}),
    (user) =>
      Effect.gen(function* getPortalEmailUpdatesProgram() {
        const notifications = yield* Notifications;
        const preferences = yield* notifications.listPreferences(user.id);
        return preferences.some(
          ({ channel, enabled, eventType }) =>
            channel === "email" && eventType === "status" && enabled
        );
      }),
    Schema.Boolean
  );
