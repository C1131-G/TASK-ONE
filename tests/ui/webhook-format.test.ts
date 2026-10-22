import { expect, it } from "bun:test";

import {
  deliveryStatusBadge,
  describeEvents,
  endpointKindLabel,
  parseSelectedEvents,
} from "../../features/webhooks/webhook-format";

it("labels each delivery status with a tone", () => {
  expect(deliveryStatusBadge("succeeded")).toEqual({
    label: "Delivered",
    tone: "green",
  });
  expect(deliveryStatusBadge("retrying")).toEqual({
    label: "Retrying",
    tone: "amber",
  });
  expect(deliveryStatusBadge("pending")).toEqual({
    label: "Queued",
    tone: "gray",
  });
  expect(deliveryStatusBadge("dead")).toEqual({
    label: "Failed",
    tone: "red",
  });
});

it("names the endpoint kinds", () => {
  expect(endpointKindLabel("generic")).toBe("Signed webhook");
  expect(endpointKindLabel("slack")).toBe("Slack incoming webhook");
});

it("describes subscribed events by their labels and skips unknown ones", () => {
  expect(
    describeEvents(["task.created", "bug.status_changed", "gone.event"])
  ).toBe("Task created, Bug status changed");
  expect(describeEvents([])).toBe("No events");
});

it("reads the checked events from a form in a stable order", () => {
  const form = new FormData();
  form.append("events", "project.created");
  form.append("events", "task.created");
  form.append("events", "not.an.event");
  expect(parseSelectedEvents(form)).toEqual([
    "task.created",
    "project.created",
  ]);
});
