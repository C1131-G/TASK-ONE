import { expect, test } from "bun:test";

import {
  moveTaskInColumn,
  orderTasksForBoard,
} from "../../features/tasks/board-order";

const task = (
  id: string,
  position: number,
  projectTaskNumber: number,
  version = 1
) => ({
  id,
  position,
  projectTaskNumber,
  version,
});

test("orders by position, then by task number", () => {
  const ordered = orderTasksForBoard([
    task("c", 0, 3),
    task("a", 0, 1),
    task("b", -1, 2),
  ]);
  expect(ordered.map(({ id }) => id)).toEqual(["b", "a", "c"]);
});

test("moving a card down swaps it with its neighbour and renumbers the column", () => {
  const column = [task("a", 0, 1), task("b", 0, 2), task("c", 0, 3)];
  const move = moveTaskInColumn(column, "a", 1);
  expect(move?.newIndex).toBe(1);
  // b keeps position 0, so only a and c are sent.
  expect(move?.changes).toEqual([
    { expectedVersion: 1, position: 1, taskId: "a" },
    { expectedVersion: 1, position: 2, taskId: "c" },
  ]);
});

test("unchanged positions are not sent", () => {
  const column = [task("a", 0, 1), task("b", 1, 2), task("c", 2, 3)];
  const move = moveTaskInColumn(column, "c", -1);
  expect(move?.changes.map((change) => change.taskId)).toEqual(["c", "b"]);
});

test("returns null at the edges, for unknown tasks, and for columns over the reorder limit", () => {
  const column = [task("a", 0, 1), task("b", 1, 2)];
  expect(moveTaskInColumn(column, "a", -1)).toBeNull();
  expect(moveTaskInColumn(column, "b", 1)).toBeNull();
  expect(moveTaskInColumn(column, "missing", 1)).toBeNull();
  const large = Array.from({ length: 101 }, (_, index) =>
    task(`t${index}`, index, index + 1)
  );
  expect(moveTaskInColumn(large, "t0", 1)).toBeNull();
});
