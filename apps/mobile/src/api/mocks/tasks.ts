import type { MockFixture } from "@/api/mock/mock-fetch";

const T1 = {
  assigneeNames: ["Ada Lovelace"],
  dueAt: "2026-11-02T00:00:00.000Z",
  id: "a1b2c3d4-1111-4a11-8a11-a1b2c3d40001",
  priority: "high",
  projectId: "0b6c8a52-5f1e-4c0e-9a33-6a0f1d2c7e11",
  projectName: "Website relaunch",
  status: "progress",
  title: "Ship the landing page",
  version: 3,
};

const T2 = {
  assigneeNames: ["Grace Hopper"],
  dueAt: null,
  id: "a1b2c3d4-1111-4a11-8a11-a1b2c3d40002",
  priority: "medium",
  projectId: "0b6c8a52-5f1e-4c0e-9a33-6a0f1d2c7e11",
  projectName: "Website relaunch",
  status: "todo",
  title: "Draft the launch announcement",
  version: 1,
};

const T3 = {
  assigneeNames: [],
  dueAt: null,
  id: "a1b2c3d4-1111-4a11-8a11-a1b2c3d40003",
  priority: "low",
  projectId: "0b6c8a52-5f1e-4c0e-9a33-6a0f1d2c7e12",
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
        { done: true, id: "e5f6a7b8-2222-4b22-9b22-e5f6a7b80001", title: "Hero art" },
        { done: false, id: "e5f6a7b8-2222-4b22-9b22-e5f6a7b80002", title: "Launch checklist" },
      ],
      title: T1.title,
      version: T1.version,
    },
    operationId: "getTask",
  },
  {
    data: {
      assigneeIds: [],
      dueDate: null,
      id: "task-new",
      priority: "medium",
      projectId: "0b6c8a52-5f1e-4c0e-9a33-6a0f1d2c7e11",
      reference: "WEB-14",
      status: "todo",
      title: "New task",
      version: 1,
    },
    operationId: "createTask",
  },
  {
    data: { status: "done", version: 4 },
    operationId: "setTaskStatus",
  },
  {
    data: {
      subtasks: [
        { done: true, id: "e5f6a7b8-2222-4b22-9b22-e5f6a7b80001", title: "Hero art" },
        { done: false, id: "e5f6a7b8-2222-4b22-9b22-e5f6a7b80002", title: "Launch checklist" },
      ],
    },
    operationId: "listSubtasks",
  },
  {
    data: { done: true, version: 4 },
    operationId: "setSubtaskStatus",
  },
];
