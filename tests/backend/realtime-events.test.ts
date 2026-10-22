import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  decodeRealtimeEvent,
  encodeRealtimeEvent,
  eventsFromActivity,
} from "../../src/server/realtime/events";

const taskId = randomUUID();
const projectId = randomUUID();
const userId = randomUUID();

test("an event survives the encode and decode round trip", () => {
  const event = { kind: "task", projectId, taskId } as const;
  expect(decodeRealtimeEvent(encodeRealtimeEvent(event))).toEqual(event);
});

test("an encoded event carries ids only, never content", () => {
  const encoded = encodeRealtimeEvent({
    kind: "comment",
    taskId,
    visibility: "public",
  });
  expect(Object.keys(JSON.parse(encoded)).toSorted()).toEqual([
    "kind",
    "taskId",
    "visibility",
  ]);
});

test("malformed or foreign payloads decode to nothing", () => {
  expect(decodeRealtimeEvent("not json")).toBeNull();
  expect(decodeRealtimeEvent("[]")).toBeNull();
  expect(decodeRealtimeEvent(JSON.stringify({ kind: "task" }))).toBeNull();
  expect(
    decodeRealtimeEvent(JSON.stringify({ kind: "inbox", userId: "nope" }))
  ).toBeNull();
  expect(
    decodeRealtimeEvent(JSON.stringify({ kind: "other", taskId }))
  ).toBeNull();
});

test("a task activity becomes a task event and a comment activity a comment event", () => {
  expect(
    eventsFromActivity({ action: "task.updated", projectId, taskId })
  ).toEqual([{ kind: "task", projectId, taskId }]);
  expect(
    eventsFromActivity({
      action: "comment.created",
      details: { commentId: randomUUID(), visibility: "public" },
      projectId,
      taskId,
    })
  ).toEqual([{ kind: "comment", taskId, visibility: "public" }]);
});

test("a comment activity without a visibility stays internal", () => {
  expect(
    eventsFromActivity({ action: "comment.removed", projectId, taskId })
  ).toEqual([{ kind: "comment", taskId, visibility: "internal" }]);
});

test("project-only activity is a project event and unrelated activity is ignored", () => {
  expect(
    eventsFromActivity({ action: "milestone.created", projectId, taskId: null })
  ).toEqual([{ kind: "project", projectId }]);
  expect(eventsFromActivity({ action: "team.created" })).toEqual([]);
  expect(
    eventsFromActivity({ action: "x", projectId: "bad", taskId: null })
  ).toEqual([]);
  expect(encodeRealtimeEvent({ kind: "inbox", userId })).toContain(userId);
});
