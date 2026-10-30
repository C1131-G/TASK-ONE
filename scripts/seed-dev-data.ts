/* oxlint-disable no-await-in-loop, no-nested-ternary, id-length -- a dev seed inserts rows in order on purpose. */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { auth } from "../src/server/auth/auth";
import { authPool } from "../src/server/auth/database";

// Wipes the local development database and fills EVERY application table with
// a realistic multi-company data set: admins, employees in several teams,
// four client companies with their own portal logins, projects, tasks, bugs,
// approvals, time tracking, integrations and per-user preferences.
//
//   bun run seed:dev
//
// Every account signs in with SEED_PASSWORD (default below). The list of
// logins is printed at the end. Local, non-test Taskora databases only.

const PASSWORD = process.env["SEED_PASSWORD"] ?? "Taskora#Dev2026";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be configured before seeding.");
}
const database = new URL(databaseUrl);
const databaseName = decodeURIComponent(database.pathname.slice(1));
if (
  process.env["NODE_ENV"] === "production" ||
  !["localhost", "127.0.0.1", "::1"].includes(database.hostname) ||
  !databaseName.startsWith("taskora") ||
  databaseName.endsWith("_test")
) {
  throw new Error(
    "Seeding only runs against a local, non-test Taskora database."
  );
}

const TABLES = [
  "account",
  "activity",
  "approval_request",
  "approval_request_file",
  "audit_event",
  "automation_rule",
  "automation_run",
  "bug_approval",
  "bug_evidence",
  "bug_fix_attempt",
  "bug_relation",
  "bug_release",
  "bug_report",
  "bug_sla",
  "calendar_event",
  "calendar_event_attendee",
  "calendar_feed_token",
  "client_company",
  "client_company_handler",
  "client_company_project",
  "comment",
  "comment_reaction",
  "company_settings",
  "custom_field",
  "custom_field_value",
  "email_delivery",
  "email_setting",
  "favorite_project",
  "favorite_task",
  "file_asset",
  "github_connection",
  "github_delivery",
  "github_pull_link",
  "idempotency_key",
  "intake_form",
  "intake_submission",
  "job",
  "label",
  "notification",
  "notification_preference",
  "project",
  "project_budget",
  "project_budget_alert",
  "project_member",
  "project_milestone",
  "project_task_counter",
  "push_delivery",
  "push_subscription",
  "rateLimit",
  "recent_search",
  "recurrence_generation",
  "saved_view",
  "session",
  "task",
  "task_assignee",
  "task_dependency",
  "task_label",
  "task_recurrence",
  "task_subtask",
  "team",
  "time_entry",
  "time_timer",
  "undo_record",
  "upload_intent",
  "user",
  "user_preference",
  "verification",
  "webhook_delivery",
  "webhook_endpoint",
];

type Row = Record<string, unknown>;
const J = (value: unknown): string => JSON.stringify(value);
const id = (): string => randomUUID();

const ins = async (table: string, row: Row): Promise<void> => {
  const keys = Object.keys(row);
  const columns = keys.map((key) => `"${key}"`).join(", ");
  const marks = keys.map((_, index) => `$${index + 1}`).join(", ");
  await authPool.query(
    `INSERT INTO "${table}" (${columns}) VALUES (${marks}) ON CONFLICT DO NOTHING`,
    keys.map((key) => row[key])
  );
};

const NOW = new Date();
const day = (offset: number): string =>
  new Date(NOW.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const at = (offsetDays: number, hours = 0): Date =>
  new Date(NOW.getTime() + offsetDays * 86_400_000 + hours * 3_600_000);
const pick = <T>(list: readonly T[], index: number): T =>
  list[index % list.length] as T;

await authPool.query(
  `TRUNCATE ${TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`
);

const context = await auth.$context;
const passwordHash = await context.password.hash(PASSWORD);

// ---------------------------------------------------------------- settings
await ins("company_settings", {
  brandColor: "#1D1C1A",
  businessDays: [1, 2, 3, 4, 5],
  id: "company",
  name: "Gr8r Studio",
  settings: J({ weekStart: 1 }),
  slug: "gr8rstudio",
  timeZone: "Asia/Kolkata",
});

// ------------------------------------------------------------------- teams
const teams = [
  { color: "#2F6FEB", icon: "code", name: "Engineering" },
  { color: "#C2410C", icon: "palette", name: "Design" },
  { color: "#0F766E", icon: "headset", name: "Support" },
  { color: "#7C3AED", icon: "megaphone", name: "Marketing" },
].map((team) => ({ ...team, id: id() }));
for (const team of teams) {
  await ins("team", { ...team, description: `${team.name} team` });
}
const teamId = (name: string): string =>
  teams.find((team) => team.name === name)?.id ?? teams[0]?.id ?? "";

// ------------------------------------------------------------------- users
interface Person {
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly role: "admin" | "client" | "employee";
  readonly companyId?: string | undefined;
}
const people: Person[] = [];
const addUser = async (
  name: string,
  email: string,
  role: Person["role"],
  extra: Row = {}
): Promise<Person> => {
  const userId = id();
  const companyId = extra["clientCompanyId"] as string | undefined;
  await ins("user", {
    clientCompanyId: companyId ?? null,
    email,
    emailNormalized: email,
    emailVerified: true,
    id: userId,
    mustChangePassword: false,
    name,
    role,
    timeZone: "Asia/Kolkata",
    ...extra,
  });
  await ins("account", {
    accountId: userId,
    id: id(),
    password: passwordHash,
    providerId: "credential",
    userId,
  });
  const person: Person = { companyId, email, id: userId, name, role };
  people.push(person);
  return person;
};

const owner = await addUser("Olivia Owner", "owner@taskora.test", "admin", {
  jobTitle: "Studio Owner",
});
const admin = await addUser("Adam Admin", "admin@taskora.test", "admin", {
  jobTitle: "Operations Lead",
  teamId: teamId("Support"),
});
const staff = [
  ["Eli Engineer", "eli@taskora.test", "Engineering", "Senior Engineer"],
  ["Ena Backend", "ena@taskora.test", "Engineering", "Backend Engineer"],
  ["Ravi Frontend", "ravi@taskora.test", "Engineering", "Frontend Engineer"],
  ["Dana Designer", "dana@taskora.test", "Design", "Product Designer"],
  ["Dev Visual", "dev@taskora.test", "Design", "Visual Designer"],
  ["Sia Support", "sia@taskora.test", "Support", "Support Specialist"],
  ["Sam Success", "sam@taskora.test", "Support", "Customer Success"],
  ["Mia Marketer", "mia@taskora.test", "Marketing", "Marketing Manager"],
  ["Max Content", "max@taskora.test", "Marketing", "Content Writer"],
] as const;
const employees: Person[] = [];
for (const [name, email, team, jobTitle] of staff) {
  employees.push(
    await addUser(name, email, "employee", { jobTitle, teamId: teamId(team) })
  );
}
const fresh = await addUser("Nia NewHire", "newhire@taskora.test", "employee", {
  jobTitle: "Onboarding",
  mustChangePassword: true,
  teamId: teamId("Engineering"),
});
const former = await addUser("Finn Former", "former@taskora.test", "employee", {
  deactivatedAt: at(-20),
  deactivatedById: owner.id,
  jobTitle: "Former Engineer",
  teamId: teamId("Engineering"),
});
const staffAll = [owner, admin, ...employees];
const [eli, ena, ravi, dana, dev, sia, sam, mia, max] = employees as [
  Person,
  Person,
  Person,
  Person,
  Person,
  Person,
  Person,
  Person,
  Person,
];
await authPool.query(
  `UPDATE "user" SET "lastActiveAt" = now() WHERE role <> 'client'`
);

// --------------------------------------------------------------- companies
const companyDefs = [
  {
    handlers: [sia, sam],
    name: "Acme Corp",
    slug: "acme",
    users: ["Casey Client", "Corin Buyer", "Cleo Ops"],
  },
  {
    handlers: [sam, eli],
    name: "Globex Industries",
    slug: "globex",
    users: ["Gina Globex", "Greg Lead"],
  },
  {
    handlers: [sia],
    name: "Initech Labs",
    slug: "initech",
    users: ["Ian Initech", "Ivy Product"],
  },
  {
    handlers: [sam],
    inactive: true,
    name: "Umbrella Retail",
    slug: "umbrella",
    users: ["Uma Umbrella"],
  },
];
interface Company {
  readonly handlers: Person[];
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly users: Person[];
}
const companies: Company[] = [];
for (const def of companyDefs) {
  const companyId = id();
  await ins("client_company", {
    createdById: owner.id,
    deactivatedAt: def.inactive ? at(-10) : null,
    deactivatedById: def.inactive ? owner.id : null,
    id: companyId,
    name: def.name,
  });
  const users: Person[] = [];
  for (const [index, name] of def.users.entries()) {
    users.push(
      await addUser(
        name,
        `${name.split(" ")[0]?.toLowerCase()}@${def.slug}.test`,
        "client",
        {
          clientCompanyId: companyId,
          mustChangePassword: def.slug === "initech" && index === 1,
        }
      )
    );
  }
  for (const handler of def.handlers) {
    await ins("client_company_handler", {
      assignedById: owner.id,
      companyId,
      employeeId: handler.id,
      id: id(),
    });
  }
  companies.push({
    handlers: def.handlers,
    id: companyId,
    name: def.name,
    slug: def.slug,
    users,
  });
}
const [acme, globex, initech, umbrella] = companies as [
  Company,
  Company,
  Company,
  Company,
];

// ---------------------------------------------------------------- projects
interface Project {
  readonly id: string;
  readonly key: string;
  readonly members: Person[];
  readonly name: string;
  taskCount: number;
}
const projectDefs = [
  {
    color: "blue",
    company: acme,
    key: "ACME",
    lead: eli,
    members: [eli, ena, ravi, dana, sia],
    name: "Acme Web Platform",
    status: "active",
    team: "Engineering",
    visible: true,
  },
  {
    color: "teal",
    company: acme,
    key: "ACMEM",
    lead: ravi,
    members: [ravi, dev, sia],
    name: "Acme Mobile App",
    status: "risk",
    team: "Engineering",
    visible: true,
  },
  {
    color: "orange",
    company: globex,
    key: "GLBX",
    lead: dana,
    members: [dana, dev, sam, eli],
    name: "Globex Brand Refresh",
    status: "active",
    team: "Design",
    visible: true,
  },
  {
    color: "purple",
    company: globex,
    key: "GLAPI",
    lead: ena,
    members: [ena, eli, sam],
    name: "Globex Partner API",
    status: "planning",
    team: "Engineering",
    visible: true,
  },
  {
    color: "green",
    company: initech,
    key: "INIT",
    lead: eli,
    members: [eli, ravi, sia, mia],
    name: "Initech Portal Rebuild",
    status: "active",
    team: "Engineering",
    visible: true,
  },
  {
    color: "red",
    company: umbrella,
    key: "UMB",
    lead: mia,
    members: [mia, max, sam],
    name: "Umbrella Campaign",
    status: "hold",
    team: "Marketing",
    visible: true,
  },
  {
    color: "slate",
    company: null,
    key: "INT",
    lead: admin,
    members: staffAll.filter((p) => p.id !== owner.id),
    name: "Internal Tooling",
    status: "active",
    team: "Engineering",
    visible: false,
  },
  {
    color: "pink",
    company: null,
    key: "MKT",
    lead: mia,
    members: [mia, max, dana],
    name: "Website Content Calendar",
    status: "planning",
    team: "Marketing",
    visible: false,
  },
  {
    archived: true,
    color: "yellow",
    company: null,
    key: "ARCH",
    lead: admin,
    members: [admin, eli],
    name: "Archived Legacy Site",
    status: "complete",
    team: "Engineering",
    visible: false,
  },
];
const projects: Project[] = [];
let projectPosition = 0;
for (const def of projectDefs) {
  const projectId = id();
  await ins("project", {
    archivedAt: def.archived ? at(-30) : null,
    archivedById: def.archived ? admin.id : null,
    clientVisible: def.visible,
    color: def.color,
    description: `${def.name} — seeded project for local testing.`,
    dueDate: day(45 + projectPosition * 7),
    icon: "folder",
    id: projectId,
    key: def.key,
    leadId: def.lead.id,
    name: def.name,
    position: projectPosition,
    startDate: day(-60),
    status: def.status,
    teamId: teamId(def.team),
  });
  projectPosition += 1;
  const members = [...new Set([owner, ...def.members])];
  for (const member of members) {
    await ins("project_member", { projectId, userId: member.id });
  }
  if (def.company) {
    await ins("client_company_project", {
      companyId: def.company.id,
      id: id(),
      projectId,
    });
  }
  projects.push({
    id: projectId,
    key: def.key,
    members,
    name: def.name,
    taskCount: 0,
  });
}
const proj = (key: string): Project =>
  projects.find((project) => project.key === key) as Project;

// Previously linked, now removed client project.
await ins("client_company_project", {
  addedAt: at(-40),
  companyId: initech.id,
  id: id(),
  projectId: proj("INT").id,
  removedAt: at(-15),
});

// ------------------------------------------------------------------ labels
const labels = [
  ["Frontend", "#2F6FEB"],
  ["Backend", "#0F766E"],
  ["Design", "#C2410C"],
  ["Urgent client", "#DC2626"],
  ["Research", "#7C3AED"],
  ["Quick win", "#65A30D"],
].map(([name, color]) => ({
  color: color as string,
  id: id(),
  name: name as string,
}));
for (const label of labels) {
  await ins("label", label);
}

// ------------------------------------------------------------------- tasks
const TITLES = [
  "Set up project scaffolding",
  "Design landing page layout",
  "Implement login flow",
  "Write API documentation",
  "Fix pagination on list view",
  "Review client feedback",
  "Prepare sprint demo",
  "Integrate payment provider",
  "Audit accessibility issues",
  "Optimise image loading",
  "Draft release notes",
  "Migrate legacy data",
  "Add email notifications",
  "Refine onboarding copy",
  "Build analytics dashboard",
];
const STATUSES = [
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
  "todo",
  "progress",
  "done",
] as const;
const PRIORITIES = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
  "medium",
  "high",
] as const;
interface Task {
  readonly id: string;
  readonly number: number;
  readonly project: Project;
  readonly status: string;
  readonly title: string;
}
const tasks: Task[] = [];
const taskInsert = async (
  project: Project,
  title: string,
  options: Row & {
    assignees?: Person[] | undefined;
    creator?: Person | undefined;
  } = {}
): Promise<Task> => {
  const { assignees, creator, ...rest } = options;
  project.taskCount += 1;
  const taskId = id();
  const status = (rest["status"] as string | undefined) ?? "todo";
  const author = creator ?? pick(project.members, project.taskCount);
  await ins("task", {
    clientVisible: project.key !== "INT" && project.key !== "MKT",
    completedAt: status === "done" ? at(-2) : null,
    createdAt: at(-30 + project.taskCount),
    createdById: author.id,
    description: `Seeded task for ${project.name}.`,
    dueDate: day(project.taskCount * 2 - 12),
    estimate: pick(["1h", "2h", "4h", "1d", "3d"], project.taskCount),
    id: taskId,
    position: project.taskCount * 1000,
    priority: pick(PRIORITIES, project.taskCount),
    projectId: project.id,
    projectTaskNumber: project.taskCount,
    startDate: day(project.taskCount - 14),
    status,
    title,
    ...rest,
  });
  const owners = assignees ?? [pick(project.members, project.taskCount + 1)];
  for (const assignee of owners) {
    await ins("task_assignee", {
      assignedById: author.id,
      taskId,
      userId: assignee.id,
    });
  }
  const task: Task = {
    id: taskId,
    number: project.taskCount,
    project,
    status,
    title,
  };
  tasks.push(task);
  return task;
};

for (const [projectIndex, project] of projects.entries()) {
  const count = project.key === "ARCH" ? 4 : 11;
  for (let index = 0; index < count; index += 1) {
    const status =
      project.key === "ARCH" ? "done" : pick(STATUSES, index + projectIndex);
    await taskInsert(project, `${pick(TITLES, index + projectIndex * 3)}`, {
      archivedAt: index === count - 1 && project.key !== "ARCH" ? at(-5) : null,
      archivedById:
        index === count - 1 && project.key !== "ARCH" ? admin.id : null,
      assignees:
        index % 4 === 0
          ? [pick(project.members, index), pick(project.members, index + 1)]
          : undefined,
      status,
    });
  }
}

// Task relations ------------------------------------------------------------
const byProject = (key: string): Task[] =>
  tasks.filter((task) => task.project.key === key);
for (const [index, task] of tasks.entries()) {
  if (index % 3 === 0) {
    await ins("task_label", {
      labelId: pick(labels, index).id,
      taskId: task.id,
    });
  }
  if (index % 5 === 0) {
    await ins("task_label", {
      labelId: pick(labels, index + 2).id,
      taskId: task.id,
    });
  }
}
for (const key of ["ACME", "GLBX", "INIT", "INT"]) {
  const list = byProject(key);
  for (let index = 1; index < 4; index += 1) {
    const task = list[index];
    const blocker = list[index - 1];
    if (task && blocker) {
      await ins("task_dependency", {
        dependsOnTaskId: blocker.id,
        taskId: task.id,
      });
    }
  }
}
for (const [index, task] of tasks.slice(0, 40).entries()) {
  if (index % 2 === 0) {
    for (let step = 0; step < 3; step += 1) {
      const done = step === 0;
      await ins("task_subtask", {
        assigneeId: pick(task.project.members, index + step).id,
        completedAt: done ? at(-1) : null,
        dueDate: day(step + 2),
        id: id(),
        isCompleted: done,
        position: step,
        taskId: task.id,
        title: `Subtask ${step + 1} of ${task.title}`,
      });
    }
  }
}

// Recurring tasks ----------------------------------------------------------
for (const [index, task] of byProject("INT").slice(0, 3).entries()) {
  await ins("task_recurrence", {
    frequency: pick(["daily", "weekly", "biweekly", "monthly"], index),
    id: id(),
    interval: 1,
    nextRunAt: day(index + 1),
    taskId: task.id,
    weekDays: index === 1 ? J([1, 3]) : null,
  });
}
{
  const source = byProject("INT")[0] as Task;
  const successor = await taskInsert(proj("INT"), `${source.title} (next)`, {
    status: "todo",
  });
  await ins("recurrence_generation", {
    generationKey: `${source.id}:${day(0)}`,
    id: id(),
    sourceTaskId: source.id,
    successorTaskId: successor.id,
  });
}

// Comments -----------------------------------------------------------------
const commentIds: { id: string; author: Person }[] = [];
for (const [index, task] of tasks.slice(0, 60).entries()) {
  const company = companies.find((entry) =>
    projectDefs.some(
      (def) => def.key === task.project.key && def.company === entry
    )
  );
  const clientVoice = company && index % 3 === 0;
  const author = clientVoice
    ? pick(company.users, index)
    : pick(task.project.members, index);
  const commentId = id();
  await ins("comment", {
    authorId: author.id,
    body: clientVoice
      ? "Could we get an update on this one? It is blocking our launch."
      : `Working on this, see notes. cc @[${pick(task.project.members, index + 1).id}]`,
    createdAt: at(-10 + (index % 8)),
    deletedAt: index === 7 ? at(-1) : null,
    deletedById: index === 7 ? admin.id : null,
    id: commentId,
    taskId: task.id,
    visibility: clientVoice || index % 2 === 0 ? "public" : "internal",
  });
  commentIds.push({ author, id: commentId });
}
for (const [index, comment] of commentIds.entries()) {
  if (index % 2 === 0) {
    await ins("comment_reaction", {
      commentId: comment.id,
      emoji: pick(["👍", "🎉", "👀", "✅"], index),
      userId: pick(employees, index).id,
    });
  }
}

// Activity ------------------------------------------------------------------
for (const [index, task] of tasks.entries()) {
  await ins("activity", {
    action: "task.created",
    actorId: pick(task.project.members, index).id,
    createdAt: at(-30 + (index % 25)),
    details: J({ title: task.title }),
    id: id(),
    projectId: task.project.id,
    taskId: task.id,
  });
  if (task.status !== "todo" && task.status !== "backlog") {
    await ins("activity", {
      action: "task.status_changed",
      actorId: pick(task.project.members, index + 1).id,
      createdAt: at(-5 - (index % 5)),
      details: J({ from: "todo", to: task.status }),
      id: id(),
      projectId: task.project.id,
      taskId: task.id,
    });
  }
}

// Notifications -------------------------------------------------------------
const NOTIFICATION_TYPES = [
  "assignment",
  "mention",
  "comment",
  "update",
  "due",
  "status",
] as const;
const notificationIds: { id: string; userId: string }[] = [];
for (const [index, task] of tasks.slice(0, 80).entries()) {
  const recipient = pick(task.project.members, index + 2);
  const notificationId = id();
  const type = pick(NOTIFICATION_TYPES, index);
  await ins("notification", {
    actorId: pick(task.project.members, index).id,
    createdAt: at(-(index % 12)),
    id: notificationId,
    projectId: task.project.id,
    readAt: index % 3 === 0 ? at(-1) : null,
    snippet: type === "comment" ? "Looks good to me." : null,
    targetId: task.id,
    targetType: "task",
    taskId: task.id,
    text: `${type} on ${task.project.key}-${task.number}: ${task.title}`,
    type,
    userId: recipient.id,
  });
  notificationIds.push({ id: notificationId, userId: recipient.id });
}

// Preferences ---------------------------------------------------------------
for (const [index, person] of staffAll.entries()) {
  await ins("email_setting", {
    digest: index % 2 === 0,
    lastDigestAt: index % 2 === 0 ? at(-1) : null,
    userId: person.id,
  });
  await ins("user_preference", {
    id: id(),
    key: "theme",
    userId: person.id,
    value: J({ mode: index % 2 ? "dark" : "light" }),
  });
  await ins("user_preference", {
    id: id(),
    key: "sidebar",
    userId: person.id,
    value: J({ collapsed: false }),
  });
  for (const channel of ["in-app", "email", "web-push"]) {
    await ins("notification_preference", {
      channel,
      enabled: !(channel === "web-push" && index % 3 === 0),
      eventType: pick(["mention", "assignment", "comment", "due"], index),
      id: id(),
      userId: person.id,
    });
  }
  await ins("calendar_feed_token", {
    id: id(),
    tokenHash: randomUUID().replaceAll("-", ""),
    userId: person.id,
  });
  await ins("recent_search", {
    id: id(),
    query: pick(["login", "invoice", "design", "bug"], index),
    userId: person.id,
  });
  await ins("favorite_project", {
    projectId: pick(projects, index).id,
    userId: person.id,
  });
  await ins("favorite_task", {
    taskId: pick(tasks, index * 3).id,
    userId: person.id,
  });
  await ins("saved_view", {
    filters: J([{ field: "status", op: "in", values: ["todo", "progress"] }]),
    groupBy: "status",
    id: id(),
    isShared: index % 2 === 0,
    name: `${person.name.split(" ")[0]} open work`,
    projectId: index % 2 ? pick(projects, index).id : null,
    sort: J({ direction: "asc", field: "dueDate" }),
    type: pick(["board", "list", "table", "calendar", "timeline"], index),
    userId: person.id,
  });
}
for (const [index, person] of [eli, dana, sia].entries()) {
  await ins("push_subscription", {
    endpoint: `https://fcm.googleapis.com/fcm/send/seed-${index}-${randomUUID()}`,
    id: id(),
    keys: J({ auth: "seed-auth", p256dh: "seed-p256dh" }),
    userAgent: "Seed Browser",
    userId: person.id,
  });
  const note =
    notificationIds.find((entry) => entry.userId === person.id) ??
    notificationIds[index];
  if (note) {
    await ins("push_delivery", {
      endpointHash: randomUUID().replaceAll("-", ""),
      id: id(),
      notificationId: note.id,
      userId: note.userId,
    });
  }
  await ins("email_delivery", {
    dedupeKey: `seed:digest:${person.id}:${day(0)}`,
    id: id(),
    userId: person.id,
  });
}

// Time tracking & budgets ---------------------------------------------------
for (const [index, task] of tasks.slice(0, 90).entries()) {
  const worker = pick(task.project.members, index);
  await ins("time_entry", {
    billable: index % 3 !== 0,
    id: id(),
    minutes: 30 + ((index * 25) % 210),
    note: index % 2 ? "Implementation" : "Review and fixes",
    taskId: task.id,
    userId: worker.id,
    workDate: day(-(index % 20)),
  });
}
await ins("time_timer", {
  billable: true,
  note: "Live timer",
  startedAt: at(0, -1),
  taskId: (byProject("ACME")[2] as Task).id,
  userId: eli.id,
});
const period = day(0).slice(0, 7);
for (const [key, kind, minutes, rate] of [
  ["ACME", "retainer", 4800, 9500],
  ["GLBX", "one_off", 7200, 12_000],
  ["INIT", "one_off", 2400, null],
] as const) {
  const projectId = proj(key).id;
  await ins("project_budget", {
    billableOnly: key === "ACME",
    budgetMinutes: minutes,
    currency: "USD",
    hourlyRateCents: rate,
    kind,
    projectId,
    warningPercent: 80,
  });
  await ins("project_budget_alert", {
    level: "warning",
    periodKey: period,
    projectId,
  });
}
await ins("project_budget_alert", {
  level: "overrun",
  periodKey: period,
  projectId: proj("INIT").id,
});

// Milestones & custom fields ------------------------------------------------
const milestones: { id: string; name: string; projectId: string }[] = [];
for (const key of ["ACME", "GLBX", "INIT", "INT"]) {
  for (const [position, name] of ["Kickoff", "Beta", "Launch"].entries()) {
    const milestoneId = id();
    await ins("project_milestone", {
      completedAt: position === 0 ? at(-20) : null,
      dueDate: day(position * 20 - 15),
      id: milestoneId,
      name,
      position,
      projectId: proj(key).id,
    });
    milestones.push({ id: milestoneId, name, projectId: proj(key).id });
  }
}
for (const key of ["ACME", "INIT"]) {
  const projectId = proj(key).id;
  const fields = [
    ["Customer ref", "text", null],
    ["Story points", "number", null],
    ["Environment", "select", J(["dev", "staging", "prod"])],
    ["Go-live", "date", null],
    ["Reviewed", "checkbox", null],
  ] as const;
  const fieldIds: string[] = [];
  for (const [position, [name, type, options]] of fields.entries()) {
    const fieldId = id();
    fieldIds.push(fieldId);
    await ins("custom_field", {
      id: fieldId,
      name,
      options,
      position,
      projectId,
      required: false,
      type,
    });
  }
  for (const [index, task] of byProject(key).slice(0, 5).entries()) {
    await ins("custom_field_value", {
      fieldId: fieldIds[0],
      id: id(),
      taskId: task.id,
      textValue: `REF-${1000 + index}`,
    });
    await ins("custom_field_value", {
      fieldId: fieldIds[1],
      id: id(),
      numberValue: (index + 1) * 2,
      taskId: task.id,
    });
    await ins("custom_field_value", {
      fieldId: fieldIds[2],
      id: id(),
      taskId: task.id,
      textValue: pick(["dev", "staging", "prod"], index),
    });
    await ins("custom_field_value", {
      dateValue: day(index * 3),
      fieldId: fieldIds[3],
      id: id(),
      taskId: task.id,
    });
    await ins("custom_field_value", {
      boolValue: index % 2 === 0,
      fieldId: fieldIds[4],
      id: id(),
      taskId: task.id,
    });
  }
}

// Calendar -------------------------------------------------------------------
for (const [index, title] of [
  "Sprint planning",
  "Client sync",
  "Design review",
  "Retro",
  "Launch go/no-go",
  "Team lunch",
].entries()) {
  const eventId = id();
  await ins("calendar_event", {
    createdById: pick(staffAll, index).id,
    description: `${title} (seeded)`,
    endsAt: at(index - 2, 10),
    id: eventId,
    location: index % 2 ? "Meet" : "Room 2",
    projectId: index === 5 ? null : pick(projects, index).id,
    startsAt: at(index - 2, 9),
    title,
  });
  for (const attendee of [
    pick(employees, index),
    pick(employees, index + 3),
    admin,
  ]) {
    await ins("calendar_event_attendee", { eventId, userId: attendee.id });
  }
}

// Files & approvals ----------------------------------------------------------
const files: { id: string; projectId: string }[] = [];
for (const [index, task] of byProject("ACME").slice(0, 4).entries()) {
  const fileId = id();
  await ins("file_asset", {
    contentType: pick(
      ["image/png", "application/pdf", "text/plain", "image/jpeg"],
      index
    ),
    id: fileId,
    originalName: pick(
      ["mockup.png", "spec.pdf", "notes.txt", "photo.jpg"],
      index
    ),
    projectId: task.project.id,
    sizeBytes: 20_000 + index * 15_000,
    storageKey: `seed/${fileId}`,
    taskId: index % 2 ? task.id : null,
    uploadedById: pick(task.project.members, index).id,
  });
  files.push({ id: fileId, projectId: task.project.id });
  await ins("upload_intent", {
    contentType: "text/plain",
    expiresAt: at(1),
    fileName: `pending-${index}.txt`,
    finalizedAt: index === 0 ? at(0) : null,
    id: id(),
    objectKey: `seed/intent-${randomUUID()}`,
    ownerId: pick(task.project.members, index).id,
    projectId: task.project.id,
    sizeBytes: 2048,
    state: index === 0 ? "finalized" : "pending",
    taskId: task.id,
  });
}
const approvalStates = [
  ["pending", {}],
  ["approved", { decidedAt: at(-2), decidedById: acme.users[0]?.id }],
  [
    "changes_requested",
    {
      decidedAt: at(-1),
      decidedById: acme.users[1]?.id,
      decisionComment: "Please adjust the header.",
    },
  ],
  ["cancelled", { cancelledAt: at(-3), cancelledById: eli.id }],
] as const;
for (const [index, [status, extra]] of approvalStates.entries()) {
  const approvalId = id();
  const task = byProject("ACME")[index + 2] as Task;
  await ins("approval_request", {
    companyId: acme.id,
    id: approvalId,
    message: "Please review the attached deliverable.",
    milestoneId: index === 3 ? milestones[1]?.id : null,
    projectId: task.project.id,
    requestedById: eli.id,
    status,
    subjectKey: `${task.project.key}-${task.number}`,
    subjectTitle: task.title,
    taskId: index === 3 ? null : task.id,
    version: 1,
    ...extra,
  });
  const file = files[index];
  if (file) {
    await ins("approval_request_file", {
      fileId: file.id,
      id: id(),
      requestId: approvalId,
    });
  }
}

// Bugs -----------------------------------------------------------------------
interface BugOptions {
  readonly client?: { company: Company; user: Person } | undefined;
  readonly status: string;
}
const addBug = async (project: Project, title: string, options: BugOptions) => {
  const reporter =
    options.client?.user ?? pick(project.members, project.taskCount);
  const task = await taskInsert(project, title, {
    creator: reporter,
    priority: "high",
    status:
      options.status === "closed" || options.status === "released"
        ? "done"
        : "progress",
    type: "bug",
  });
  const bugId = id();
  const { status } = options;
  const picked = ["in_progress", "in_verification"].includes(status);
  await ins("bug_report", {
    actualBehavior: "The page crashes after saving.",
    awaitingClientSince: status === "awaiting_client" ? at(-2) : null,
    browser: "Chrome 140",
    clientCompanyId: options.client?.company.id ?? null,
    clientImpact: options.client ? "high" : null,
    component: "Settings",
    description: `${title} (seeded bug)`,
    device: "Desktop",
    discoverySource: options.client ? "customer_report" : "internal_qa",
    environment: "production",
    expectedBehavior: "Saving keeps the page open.",
    id: bugId,
    needsInfoSince: status === "needs_info" ? at(-2) : null,
    os: "Windows 11",
    pickedAt: picked ? at(-3) : null,
    pickedById: picked ? ena.id : null,
    projectId: project.id,
    reporterId: reporter.id,
    reproductionSteps: ["Open settings", "Change a value", "Click save"],
    resolution:
      status === "closed"
        ? "fixed"
        : status === "rejected"
          ? "not_a_bug"
          : null,
    route: "/settings",
    satisfaction: status === "closed" ? "up" : null,
    satisfactionComment: status === "closed" ? "Fixed quickly, thanks." : null,
    severity: pick(
      ["blocker", "critical", "major", "minor", "trivial"],
      project.taskCount
    ),
    status,
    statusBeforeNeedsInfo: status === "needs_info" ? "triaged" : null,
    taskId: task.id,
  });
  await ins("bug_sla", {
    breachedResponse: status === "reported",
    bugId,
    firstRespondedAt: status === "reported" ? null : at(-2),
    firstResponseDueAt: at(-1),
    resolutionDueAt: at(3),
    resolutionStartedAt: at(-4),
    resolvedAt: ["closed", "released"].includes(status) ? at(-1) : null,
  });
  const stages = [
    "in_verification",
    "awaiting_admin_approval",
    "approved_for_release",
    "released",
    "closed",
  ];
  if (stages.includes(status)) {
    const attemptId = id();
    const verified = status !== "in_verification";
    await ins("bug_fix_attempt", {
      affectedVersion: "1.4.0",
      authorId: ena.id,
      bugReportId: bugId,
      fixSummary: "Guarded the null value.",
      fixedVersion: "1.4.1",
      id: attemptId,
      pullRequestUrl: "https://github.com/example/apps/web/app/pull/42",
      rootCause: "A missing null check.",
      testedEnvironment: verified ? "staging" : null,
      testedVersion: verified ? "1.4.1" : null,
      verificationNotes: verified ? "Verified on staging." : null,
      verificationOutcome: verified ? "passed" : null,
      verificationSteps: ["Reproduce", "Apply fix", "Confirm"],
      verifiedAt: verified ? at(-1) : null,
      verifiedById: verified ? sia.id : null,
    });
    await ins("bug_evidence", {
      bugReportId: bugId,
      caption: "Before the fix",
      externalUrl: "https://example.com/before.png",
      fixAttemptId: attemptId,
      id: id(),
      kind: "before",
      uploadedById: ena.id,
    });
    const [file] = files;
    if (file) {
      await ins("bug_evidence", {
        bugReportId: bugId,
        caption: "After the fix",
        fileAssetId: file.id,
        fixAttemptId: attemptId,
        id: id(),
        kind: "after",
        uploadedById: sia.id,
      });
    }
    if (status !== "in_verification") {
      const approvalId = id();
      const decided = status !== "awaiting_admin_approval";
      await ins("bug_approval", {
        bugReportId: bugId,
        decidedAt: decided ? at(-1) : null,
        decidedById: decided ? admin.id : null,
        fixAttemptId: attemptId,
        id: approvalId,
        snapshot: J({ summary: "Guarded the null value." }),
        status: decided ? "approved" : "pending",
        submittedById: ena.id,
      });
      if (["released", "closed"].includes(status)) {
        await ins("bug_release", {
          approvalId,
          bugReportId: bugId,
          checkedAt: at(0),
          environment: "production",
          id: id(),
          postReleaseCheckNotes: "Smoke test passed.",
          postReleaseCheckPassed: true,
          releasedAt: at(-1),
          releasedById: admin.id,
          version: "1.4.1",
        });
      }
    }
  }
  return { bugId, task };
};

const bugStatuses = [
  "reported",
  "triaged",
  "in_progress",
  "in_verification",
  "awaiting_admin_approval",
  "approved_for_release",
  "released",
  "closed",
  "needs_info",
  "awaiting_client",
  "duplicate",
  "rejected",
  "withdrawn",
];
const bugs: { bugId: string; task: Task }[] = [];
for (const [index, status] of bugStatuses.entries()) {
  const bugCompany = [acme, globex, initech][index % 3] as Company;
  const key = ["ACME", "GLBX", "INIT"][index % 3] as string;
  bugs.push(
    await addBug(
      proj(key),
      `Bug: ${pick(["Save crashes", "Wrong total", "Broken link", "Slow search"], index)} #${index + 1}`,
      {
        client:
          index % 2 === 0
            ? { company: bugCompany, user: pick(bugCompany.users, index) }
            : undefined,
        status,
      }
    )
  );
}
await ins("bug_relation", {
  createdById: sia.id,
  fromBugReportId: bugs[10]?.bugId,
  id: id(),
  toBugReportId: bugs[0]?.bugId,
  type: "duplicate",
});
await ins("bug_relation", {
  createdById: sia.id,
  fromBugReportId: bugs[7]?.bugId,
  id: id(),
  toBugReportId: bugs[6]?.bugId,
  type: "recurrence",
});

// Intake ---------------------------------------------------------------------
for (const [index, [company, key]] of (
  [
    [acme, "ACME"],
    [globex, "GLBX"],
    [initech, "INIT"],
  ] as const
).entries()) {
  const formId = id();
  await ins("intake_form", {
    clientCompanyId: company.id,
    createdById: admin.id,
    enabled: index !== 2,
    id: formId,
    name: `${company.name} bug intake`,
    projectId: proj(key).id,
    slug: `${company.slug}-bugs`,
  });
  for (const source of ["web", "email"] as const) {
    const intakeBug = await addBug(
      proj(key),
      `Intake (${source}): ${company.name} report`,
      {
        client: { company, user: pick(company.users, 0) },
        status: "reported",
      }
    );
    await ins("intake_submission", {
      bugReportId: intakeBug.bugId,
      formId,
      id: id(),
      messageId: source === "email" ? `<${randomUUID()}@mail.test>` : null,
      referenceId: `${company.slug.toUpperCase()}-${source.toUpperCase()}-${index}${randomUUID().slice(0, 4)}`,
      reporterEmail: pick(company.users, 0).email,
      senderHash: source === "email" ? randomUUID().replaceAll("-", "") : null,
      source,
    });
  }
}

// Integrations ---------------------------------------------------------------
const connectionId = id();
await ins("github_connection", {
  autoCompleteOnMerge: true,
  createdById: admin.id,
  id: connectionId,
  projectId: proj("ACME").id,
  repoFullName: "gr8r/acme-web",
  secretCiphertext: "seed-ciphertext",
  secretHint: "seed",
});
for (const [index, state] of (
  ["open", "merged", "closed"] as const
).entries()) {
  await ins("github_pull_link", {
    authorLogin: "ena-dev",
    connectionId,
    id: id(),
    mergedAt: state === "merged" ? at(-1) : null,
    prNumber: 40 + index,
    state,
    taskId: (byProject("ACME")[index] as Task).id,
    title: `PR ${40 + index}`,
    url: `https://github.com/gr8r/acme-web/pull/${40 + index}`,
  });
  await ins("github_delivery", {
    connectionId,
    deliveryId: randomUUID(),
    event: pick(["push", "pull_request", "issues"], index),
    id: id(),
  });
}
const endpointIds: string[] = [];
for (const [index, [name, kind]] of (
  [
    ["Ops webhook", "generic"],
    ["Slack alerts", "slack"],
  ] as const
).entries()) {
  const endpointId = id();
  endpointIds.push(endpointId);
  await ins("webhook_endpoint", {
    createdById: admin.id,
    enabled: true,
    events: ["task.created", "task.status_changed", "bug.reported"],
    id: endpointId,
    kind,
    name,
    secretCiphertext: index === 0 ? "seed-ciphertext" : null,
    secretHint: index === 0 ? "seed" : null,
    url:
      index === 0
        ? "https://hooks.example.test/taskora"
        : "https://hooks.slack.test/services/seed",
  });
}
for (const [index, status] of (
  ["succeeded", "pending", "retrying", "dead"] as const
).entries()) {
  await ins("webhook_delivery", {
    attempts: index,
    deliveredAt: status === "succeeded" ? at(0) : null,
    endpointId: pick(endpointIds, index),
    eventId: id(),
    eventType: "task.created",
    id: id(),
    lastError: status === "dead" || status === "retrying" ? "HTTP 500" : null,
    payload: J({ taskId: pick(tasks, index).id }),
    responseCode:
      status === "succeeded" ? 200 : status === "pending" ? null : 500,
    status,
  });
}
const rules = [
  [
    "Auto-assign new bugs",
    "bug_reported",
    [],
    [{ type: "assign", userId: ena.id }],
  ],
  [
    "Notify on done",
    "status_changed",
    [{ field: "status", op: "in", values: ["done"] }],
    [{ message: "A task was completed.", type: "notify" }],
  ],
  [
    "Escalate urgent",
    "priority_changed",
    [{ field: "priority", op: "in", values: ["urgent"] }],
    [{ status: "progress", type: "set_status" }],
  ],
] as const;
for (const [index, [name, trigger, conditions, actions]] of rules.entries()) {
  const ruleId = id();
  await ins("automation_rule", {
    actions: J(actions),
    conditions: J(conditions),
    createdById: admin.id,
    enabled: index !== 2,
    id: ruleId,
    name,
    projectId: proj("ACME").id,
    trigger,
  });
  await ins("automation_run", {
    depth: 0,
    eventId: id(),
    id: id(),
    outcome: pick(["matched", "skipped", "failed"], index),
    projectId: proj("ACME").id,
    reason: index === 1 ? "no_matching_condition" : null,
    ruleId,
    taskId: (byProject("ACME")[index] as Task).id,
    trigger,
  });
}

// Operations & auth runtime --------------------------------------------------
for (const [index, kind] of [
  "notifications.daily-due-summary",
  "storage.cleanup-expired-uploads",
  "email.digest",
].entries()) {
  await ins("job", {
    attempts: index,
    completedAt: index === 0 ? at(0) : null,
    deadAt: index === 2 ? at(-1) : null,
    dedupeKey: `seed:${kind}:${day(0)}`,
    id: id(),
    kind,
    lastError: index === 2 ? "seed failure" : null,
    maxAttempts: 8,
    payload: J({ seed: true }),
  });
}
await ins("audit_event", {
  actorId: admin.id,
  details: J({ seed: true }),
  id: id(),
  ip: "127.0.0.1",
  subjectUserId: eli.id,
  type: "user.created",
  userAgent: "seed",
});
await ins("audit_event", {
  actorId: owner.id,
  details: J({ reason: "seed" }),
  id: id(),
  ip: "127.0.0.1",
  subjectUserId: former.id,
  type: "user.deactivated",
  userAgent: "seed",
});
await ins("idempotency_key", {
  actorId: eli.id,
  expiresAt: at(1),
  id: id(),
  key: randomUUID(),
  requestHash: "seed",
  response: J({ ok: true }),
});
await ins("undo_record", {
  action: "task.archive",
  actorId: eli.id,
  entityId: tasks[0]?.id,
  entityType: "task",
  expiresAt: at(1),
  id: id(),
  snapshot: J({ status: "todo" }),
});
for (const person of [owner, admin, eli, dana]) {
  await ins("session", {
    expiresAt: at(7),
    id: id(),
    ipAddress: "127.0.0.1",
    token: randomUUID(),
    userAgent: "Seed Browser",
    userId: person.id,
  });
}
await ins("verification", {
  expiresAt: at(1),
  id: id(),
  identifier: fresh.email,
  value: "seed-token",
});
await ins("rateLimit", {
  count: 1,
  id: id(),
  key: "127.0.0.1/sign-in/email",
  lastRequest: Date.now(),
});

// ------------------------------------------------------------------ report
for (const project of projects) {
  await ins("project_task_counter", {
    nextNumber: project.taskCount + 1,
    projectId: project.id,
  });
}
const empty: string[] = [];
for (const table of TABLES) {
  const result = await authPool.query<{ n: string }>(
    `SELECT count(*) AS n FROM "${table}"`
  );
  if (result.rows[0]?.n === "0") {
    empty.push(table);
  }
}
process.stdout.write(
  `Seeded ${TABLES.length - empty.length}/${TABLES.length} tables.\n${
    empty.length ? `Still empty: ${empty.join(", ")}\n` : ""
  }\nAll accounts use the password: ${PASSWORD}\n\n${people
    .map(
      (person) =>
        `${person.role.padEnd(8)} ${person.email.padEnd(28)} ${person.name}${person.companyId ? ` (${companies.find((c) => c.id === person.companyId)?.name})` : ""}`
    )
    .join("\n")}\n`
);
void [umbrella, dev, mia, max, sam, ravi, dana];
await authPool.end();
