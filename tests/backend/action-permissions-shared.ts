import { callAs, nextKey } from "./support/action-harness";
import type {
  ActionFunction,
  ActionResultLike,
  Persona,
} from "./support/action-harness";

export interface ActionEntry {
  readonly action: ActionFunction;
  readonly authOnly?: boolean;
  readonly input: () => unknown;
  readonly name: string;
}

export const entry = (
  name: string,
  action: (input: unknown) => Promise<unknown>,
  input: () => unknown,
  authOnly = false
): ActionEntry => ({
  action: action as ActionFunction,
  authOnly,
  input,
  name,
});

export const view = () => ({
  filters: {},
  groupBy: null,
  hiddenColumns: [],
  isShared: false,
  name: "Permission view",
  projectId: null,
  sort: [],
  type: "list",
});

export const eventBody = () => ({
  attendeeIds: [],
  description: null,
  endsAt: null,
  location: null,
  projectId: null,
  startsAt: "2026-01-01T00:00:00.000Z",
  title: "Permission event",
});

export const subtaskBody = () => ({
  assigneeId: null,
  description: null,
  dueDate: null,
  expectedTaskVersion: 1,
  idempotencyKey: nextKey(),
  title: "Permission subtask",
});

export const taskBody = () => ({
  assigneeIds: [],
  description: null,
  dueDate: null,
  priority: "medium",
  title: "Permission task",
});

export const collectViolations = async (
  persona: Persona,
  entries: readonly ActionEntry[],
  allowed: (result: ActionResultLike) => boolean
): Promise<string[]> => {
  const violations: string[] = [];
  for (const { action, input, name } of entries) {
    // Each call must run in order because they share the mocked request headers.
    // eslint-disable-next-line no-await-in-loop
    const result = await callAs(persona, action, input());
    if (!allowed(result)) {
      violations.push(
        `${name}: ${result.ok ? "succeeded" : `${result.error?.code} (${result.error?.message})`}`
      );
    }
  }
  return violations;
};
