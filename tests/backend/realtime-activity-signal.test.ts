import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import { signalActivityWrites } from "../../src/server/realtime/activity-signal";
import type { RealtimeEvent } from "../../src/server/realtime/events";

// A transaction stand-in with a class holding private state, like a driver.
class FakeModel {
  readonly #rows: unknown[] = [];
  created(): number {
    return this.#rows.length;
  }
  create(row: unknown): Promise<unknown> {
    this.#rows.push(row);
    return Promise.resolve(row);
  }
}

const fakeTransaction = () => {
  const activity = new FakeModel();
  const comment = new FakeModel();
  return {
    activity,
    comment,
    transaction: {
      orm: { public: { Activity: activity, Comment: comment } },
      other: 7,
    },
  };
};

const collect = () => {
  const queued: RealtimeEvent[] = [];
  return {
    queue: (events: readonly RealtimeEvent[]) => {
      queued.push(...events);
    },
    queued,
  };
};

const taskId = randomUUID();
const projectId = randomUUID();

test("creating an activity queues the matching event and still writes the row", async () => {
  const { activity, transaction } = fakeTransaction();
  const { queue, queued } = collect();
  const wrapped = signalActivityWrites(transaction, queue);
  await wrapped.orm.public.Activity.create({
    action: "task.updated",
    projectId,
    taskId,
  });
  expect(activity.created()).toBe(1);
  expect(queued).toEqual([{ kind: "task", projectId, taskId }]);
});

test("other models and other properties pass straight through", async () => {
  const { comment, transaction } = fakeTransaction();
  const { queue, queued } = collect();
  const wrapped = signalActivityWrites(transaction, queue);
  await wrapped.orm.public.Comment.create({ body: "x" });
  expect(comment.created()).toBe(1);
  expect(wrapped.other).toBe(7);
  expect(queued).toEqual([]);
});

test("activity that is not about tasks or projects queues nothing", async () => {
  const { transaction } = fakeTransaction();
  const { queue, queued } = collect();
  const wrapped = signalActivityWrites(transaction, queue);
  await wrapped.orm.public.Activity.create({ action: "team.created" });
  expect(queued).toEqual([]);
});

test("a failed activity write queues nothing", async () => {
  const { activity, transaction } = fakeTransaction();
  activity.create = () => Promise.reject(new Error("constraint"));
  const { queue, queued } = collect();
  const wrapped = signalActivityWrites(transaction, queue);
  await expect(
    wrapped.orm.public.Activity.create({
      action: "task.updated",
      projectId,
      taskId,
    })
  ).rejects.toThrow("constraint");
  expect(queued).toEqual([]);
});
