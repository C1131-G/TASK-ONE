import type { MockFixture } from "@/api/mock/mock-fetch";

const T1 = {
  assigneeNames: ["Ada Lovelace"],
  dueAt: "2026-11-02T00:00:00.000Z",
  id: "task-1",
  priority: "high",
  projectId: "proj-1",
  projectName: "Website relaunch",
  status: "progress",
  title: "Ship the landing page",
  version: 3,
};

const T2 = {
  assigneeNames: ["Grace Hopper"],
  dueAt: null,
  id: "task-2",
  priority: "medium",
  projectId: "proj-1",
  projectName: "Website relaunch",
  status: "todo",
  title: "Draft the launch announcement",
  version: 1,
};

const T3 = {
  assigneeNames: [],
  dueAt: null,
  id: "task-3",
  priority: "low",
  projectId: "proj-2",
  projectName: "Client portal",
  status: "done",
  title: "Set up the staging database",
  version: 5,
};

export const TASKS = [T1, T2, T3];

export const TASK_FIXTURES: readonly MockFixture[] = [
  {
    data: { tasks: TASKS },
    operationId: "listTasks",
  },
  {
    data: {
      assigneeNames: T1.assigneeNames,
      commentsCount: 2,
      description: "Copy, art and launch checklist for the new landing page.",
      dueAt: T1.dueAt,
      id: T1.id,
      labels: ["design", "launch"],
      priority: T1.priority,
      projectId: T1.projectId,
      projectName: T1.projectName,
      status: T1.status,
      subtasks: [
        { done: true, id: "sub-1", title: "Hero art" },
        { done: false, id: "sub-2", title: "Launch checklist" },
      ],
      title: T1.title,
      version: T1.version,
    },
    operationId: "getTask",
  },
  {
    data: { id: "task-new", number: 14, version: 1 },
    operationId: "createTask",
  },
  {
    data: { status: "done", version: 4 },
    operationId: "setTaskStatus",
  },
  {
    data: {
      subtasks: [
        { done: true, id: "sub-1", title: "Hero art" },
        { done: false, id: "sub-2", title: "Launch checklist" },
      ],
    },
    operationId: "listSubtasks",
  },
  {
    data: { done: true, version: 4 },
    operationId: "setSubtaskStatus",
  },
];
