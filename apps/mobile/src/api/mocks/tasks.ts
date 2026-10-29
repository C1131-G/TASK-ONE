import type { MockFixture } from "@/api/mock/mock-fetch";

// Ids are real UUIDs because the live task routes validate their path params.
export const TASK_IDS = {
  one: "3f0c2b6e-1d4a-4c8e-9a51-7b2d6e8f0a11",
  three: "3f0c2b6e-1d4a-4c8e-9a51-7b2d6e8f0a13",
  two: "3f0c2b6e-1d4a-4c8e-9a51-7b2d6e8f0a12",
} as const;

const PROJECT_ONE = "5a1d9c42-6b7e-4f30-8c2d-9e4b1a7f3c05";
const PROJECT_TWO = "5a1d9c42-6b7e-4f30-8c2d-9e4b1a7f3c06";
const PERSON = "9c2e4d71-8b3a-4e65-a1f0-2d7c5b9e8a30";

interface Seed {
  readonly assigneeNames: readonly string[];
  readonly dueAt: string | null;
  readonly id: string;
  readonly priority: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly status: string;
  readonly title: string;
  readonly version: number;
}

const T1: Seed = {
  assigneeNames: ["Ada Lovelace"],
  dueAt: "2026-11-02T00:00:00.000Z",
  id: TASK_IDS.one,
  priority: "high",
  projectId: PROJECT_ONE,
  projectName: "Website relaunch",
  status: "progress",
  title: "Ship the landing page",
  version: 3,
};

const T2: Seed = {
  assigneeNames: ["Grace Hopper"],
  dueAt: null,
  id: TASK_IDS.two,
  priority: "medium",
  projectId: PROJECT_ONE,
  projectName: "Website relaunch",
  status: "todo",
  title: "Draft the launch announcement",
  version: 1,
};

const T3: Seed = {
  assigneeNames: [],
  dueAt: null,
  id: TASK_IDS.three,
  priority: "low",
  projectId: PROJECT_TWO,
  projectName: "Client portal",
  status: "done",
  title: "Set up the staging database",
  version: 5,
};

export const TASKS = [T1, T2, T3];

export const SUBTASKS = [
  {
    assigneeId: null,
    completed: true,
    description: null,
    dueDate: null,
    id: "7d1f3a52-4c60-4b8e-8e19-0a5c2f6b9d41",
    position: 1,
    taskId: TASK_IDS.one,
    title: "Hero art",
  },
  {
    assigneeId: null,
    completed: false,
    description: null,
    dueDate: null,
    id: "7d1f3a52-4c60-4b8e-8e19-0a5c2f6b9d42",
    position: 2,
    taskId: TASK_IDS.one,
    title: "Launch checklist",
  },
];

const myWorkItem = (task: Seed, reference: string) => ({
  dueDate: task.dueAt === null ? null : task.dueAt.slice(0, 10),
  id: task.id,
  isOverdue: false,
  priority: task.priority,
  projectId: task.projectId,
  projectName: task.projectName,
  reference,
  status: task.status,
  title: task.title,
  version: task.version,
});

const changed = (task: Seed, reference: string) => ({
  assigneeIds: [PERSON],
  dueDate: task.dueAt === null ? null : task.dueAt.slice(0, 10),
  id: task.id,
  priority: task.priority,
  projectId: task.projectId,
  reference,
  status: task.status,
  title: task.title,
  version: task.version,
});

export const TASK_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      items: TASKS.map((task, index) => ({
        assigneeIds: [],
        assigneeNames: task.assigneeNames,
        dueDate: task.dueAt,
        id: task.id,
        priority: task.priority,
        projectId: task.projectId,
        projectName: task.projectName,
        reference: `WEB-${index + 1}`,
        status: task.status,
        title: task.title,
        version: task.version,
      })),
      nextCursor: null,
    },
    operationId: "listTasks",
  },
  {
    data: { done: true, version: 4 },
    operationId: "setSubtaskStatus",
  },
  // Live shapes, served only in tests and the demo build's own screens.
  {
    data: {
      items: [myWorkItem(T1, "WEB-12"), myWorkItem(T2, "WEB-13")],
      nextOffset: null,
    },
    operationId: "getMyWork",
  },
  {
    data: {
      assignees: [{ id: PERSON, name: "Ada Lovelace" }],
      createdById: PERSON,
      description: "Copy, art and launch checklist for the new landing page.",
      discussion: [
        {
          authorId: PERSON,
          authorName: "Ada Lovelace",
          body: "Hero art is approved.",
          createdAt: "2026-10-20T09:30:00.000Z",
          id: "b4a6c8e0-2f3d-4a1b-9c5e-6d7f8a9b0c1d",
          visibility: "public",
        },
      ],
      dueDate: "2026-11-02",
      id: TASK_IDS.one,
      isArchived: false,
      permittedActions: ["update", "manageSubtasks", "comment"],
      priority: "high",
      projectId: PROJECT_ONE,
      projectName: T1.projectName,
      reference: "WEB-12",
      startDate: null,
      status: "progress",
      subtasks: SUBTASKS,
      title: T1.title,
      type: "task",
      version: 3,
    },
    operationId: "getTaskContext",
  },
  {
    data: changed({ ...T1, status: "done", version: 4 }, "WEB-12"),
    operationId: "changeTask",
  },
  {
    data: changed(
      { ...T2, id: "3f0c2b6e-1d4a-4c8e-9a51-7b2d6e8f0a14", title: "New from mobile", version: 1 },
      "WEB-14",
    ),
    operationId: "createTask",
  },
];
