import "server-only";
import { Effect, Schema } from "effect";

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
