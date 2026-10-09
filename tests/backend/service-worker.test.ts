import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

type Listener = (event: {
  data?: { json: () => unknown };
  notification?: { close: () => void; data?: { url?: unknown } };
  waitUntil?: (promise: Promise<unknown>) => void;
}) => void;

const loadWorker = (clients: readonly unknown[] = []) => {
  const listeners = new Map<string, Listener>();
  const notifications: { title: string; options: Record<string, unknown> }[] =
    [];
  const scope = {
    addEventListener: (name: string, listener: Listener) => {
      listeners.set(name, listener);
    },
    clients: {
      matchAll: () => Promise.resolve(clients),
      openWindow: (url: string) => Promise.resolve(url),
    },
    location: { origin: "https://workspace.example" },
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        notifications.push({ options, title });
        return Promise.resolve();
      },
    },
  };
  runInNewContext(readFileSync("public/sw.js", "utf-8"), {
    URL,
    self: scope,
  });
  return { listeners, notifications };
};

it("shows push data with a stable collapse tag", async () => {
  const { listeners, notifications } = loadWorker();
  let completion: Promise<unknown> | undefined;
  listeners.get("push")?.({
    data: {
      json: () => ({
        body: "A task changed",
        tag: "notification-123",
        title: "Workspace update",
        url: "/tasks/123",
      }),
    },
    waitUntil: (promise) => {
      completion = promise;
    },
  });
  await completion;

  expect(notifications).toEqual([
    {
      options: {
        body: "A task changed",
        data: { url: "/tasks/123" },
        tag: "notification-123",
      },
      title: "Workspace update",
    },
  ]);
});

it("ignores cross-origin notification links", async () => {
  let navigated = false;
  const client = {
    focus: () => Promise.resolve(),
    navigate: () => {
      navigated = true;
      return Promise.resolve();
    },
    url: "https://workspace.example/tasks",
  };
  const { listeners } = loadWorker([client]);
  let completion: Promise<unknown> | undefined;
  let closed = false;
  listeners.get("notificationclick")?.({
    notification: {
      close: () => {
        closed = true;
      },
      data: { url: "https://attacker.example/" },
    },
    waitUntil: (promise) => {
      completion = promise;
    },
  });
  await completion;

  expect(closed).toBe(true);
  expect(navigated).toBe(false);
});

it("navigates an existing same-origin client to a safe path", async () => {
  const navigations: string[] = [];
  const client = {
    focus: () => Promise.resolve(),
    navigate: (url: string) => {
      navigations.push(url);
      return Promise.resolve();
    },
    url: "https://workspace.example/",
  };
  const { listeners } = loadWorker([client]);
  let completion: Promise<unknown> | undefined;
  listeners.get("notificationclick")?.({
    notification: {
      close: () => {},
      data: { url: "/tasks/123?tab=activity" },
    },
    waitUntil: (promise) => {
      completion = promise;
    },
  });
  await completion;

  expect(navigations).toEqual([
    "https://workspace.example/tasks/123?tab=activity",
  ]);
});
