import { describe, expect, it } from "bun:test";

import "./support/server-only-stub";
import {
  WEBHOOK_EVENT_TYPES,
  buildWebhookEvent,
  formatSlackMessage,
} from "../../src/server/webhooks/webhook-events";

const eventId = "6b0ad0aa-2c8f-4d6c-9f17-2f1b7a0e5c11";
const createdAt = new Date("2026-10-21T10:00:00.000Z");

describe("buildWebhookEvent", () => {
  it("lists the supported event types", () => {
    expect([...WEBHOOK_EVENT_TYPES]).toEqual([
      "task.created",
      "task.updated",
      "task.completed",
      "comment.added",
      "bug.status_changed",
      "project.created",
    ]);
  });

  it("wraps task data in a versioned envelope with only public fields", () => {
    const event = buildWebhookEvent("task.created", {
      createdAt,
      data: {
        // Fields a caller might pass by mistake must not leak.
        clientVisible: false,
        description: "<p>internal notes</p>",
        dueDate: new Date("2026-11-02T00:00:00.000Z"),
        id: "task-1",
        priority: "high",
        projectId: "project-1",
        projectTaskNumber: 7,
        status: "todo",
        title: "Ship it",
      },
      id: eventId,
    });
    expect(event).toEqual({
      createdAt: "2026-10-21T10:00:00.000Z",
      data: {
        dueDate: "2026-11-02",
        id: "task-1",
        priority: "high",
        projectId: "project-1",
        projectTaskNumber: 7,
        status: "todo",
        title: "Ship it",
      },
      id: eventId,
      type: "task.created",
      version: 1,
    });
  });

  it("carries only ids and the visibility for comments, never the body", () => {
    const event = buildWebhookEvent("comment.added", {
      createdAt,
      data: {
        body: "secret text",
        id: "comment-1",
        projectId: "project-1",
        taskId: "task-1",
        visibility: "public",
      },
      id: eventId,
    });
    expect(event.data).toEqual({
      id: "comment-1",
      projectId: "project-1",
      taskId: "task-1",
      visibility: "public",
    });
  });

  it("describes a bug status change by ids and the two statuses", () => {
    const event = buildWebhookEvent("bug.status_changed", {
      createdAt,
      data: {
        bugId: "bug-1",
        from: "reported",
        projectId: "project-1",
        reporterEmail: "client@example.com",
        taskId: "task-1",
        to: "triaged",
      },
      id: eventId,
    });
    expect(event.data).toEqual({
      bugId: "bug-1",
      from: "reported",
      projectId: "project-1",
      taskId: "task-1",
      to: "triaged",
    });
  });

  it("describes a created project by id and name", () => {
    const event = buildWebhookEvent("project.created", {
      createdAt,
      data: { budget: 5000, id: "project-1", name: "Atlas" },
      id: eventId,
    });
    expect(event.data).toEqual({ id: "project-1", name: "Atlas" });
  });
});

describe("formatSlackMessage", () => {
  const taskEvent = buildWebhookEvent("task.completed", {
    createdAt,
    data: {
      dueDate: null,
      id: "task-1",
      priority: "low",
      projectId: "project-1",
      projectTaskNumber: 3,
      status: "done",
      title: "Fix <!channel> & friends",
    },
    id: eventId,
  });

  it("produces a plain text message", () => {
    const message = formatSlackMessage(taskEvent);
    expect(Object.keys(message)).toEqual(["text"]);
    expect(message.text).toContain("Task completed");
  });

  it("escapes Slack control characters so a title cannot ping a channel", () => {
    const { text } = formatSlackMessage(taskEvent);
    expect(text).toContain("Fix &lt;!channel&gt; &amp; friends");
    expect(text).not.toContain("<!channel>");
  });

  it("formats each event type", () => {
    for (const type of WEBHOOK_EVENT_TYPES) {
      const event = buildWebhookEvent(type, {
        createdAt,
        data: { id: "x", name: "N", title: "T" },
        id: eventId,
      });
      expect(formatSlackMessage(event).text.length).toBeGreaterThan(0);
    }
  });
});
