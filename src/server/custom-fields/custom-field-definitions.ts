import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { Transaction } from "../work/work-internal";
import type {
  CreateCustomFieldInput,
  CustomFieldDraft,
  CustomFieldView,
} from "./custom-field-contracts";
import {
  MAX_FIELDS_PER_PROJECT,
  parseFieldDefinition,
} from "./custom-field-definition";
import {
  fieldTypeOf,
  invalid,
  isUuid,
  loadAdminActor,
  loadStaffActor,
  notFound,
  optionsOf,
  recordActivity,
  toActionError,
  toView,
} from "./custom-field-internal";

const sameName = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase();

// Touching the project row first makes concurrent edits to one project's
// fields take turns, so the limit and the unique name cannot be raced past.
const lockActiveProject = async (
  transaction: Transaction,
  projectId: string
): Promise<void> => {
  if (!isUuid(projectId)) {
    throw notFound("project");
  }
  const project = await transaction.orm.public.Project.where({
    id: projectId,
  })
    .select("archivedAt")
    .first();
  if (!project) {
    throw notFound("project");
  }
  if (project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived projects are read only.",
    });
  }
  await transaction.orm.public.Project.where({
    id: projectId,
  }).updateAndCount({ updatedAt: new Date() });
};

export const assertFreeName = (
  existing: readonly { readonly id: string; readonly name: string }[],
  name: string,
  ignoreId?: string
): void => {
  if (existing.some((row) => row.id !== ignoreId && sameName(row.name, name))) {
    throw invalid(
      "Another field in this project already has that name.",
      "name"
    );
  }
};

const createInTransaction = async (
  transaction: Transaction,
  actorId: string,
  input: CreateCustomFieldInput
): Promise<{ readonly id: string }> => {
  await loadAdminActor(transaction, actorId);
  const parsed = parseFieldDefinition(input);
  if (!parsed.ok) {
    throw invalid(parsed.message, parsed.field);
  }
  await lockActiveProject(transaction, input.projectId);
  const active = await transaction.orm.public.CustomField.where({
    archivedAt: null,
    projectId: input.projectId,
  })
    .select("id", "name", "position")
    .all();
  if (active.length >= MAX_FIELDS_PER_PROJECT) {
    throw invalid(
      `A project can have at most ${MAX_FIELDS_PER_PROJECT} custom fields. Archive one first.`
    );
  }
  assertFreeName(active, parsed.name);
  const id = randomUUID();
  await transaction.orm.public.CustomField.create({
    id,
    name: parsed.name,
    options: parsed.options ? [...parsed.options] : null,
    position: Math.max(-1, ...active.map(({ position }) => position)) + 1,
    projectId: input.projectId,
    required: input.required,
    type: parsed.type,
  });
  await recordActivity(transaction, {
    action: "project.custom_field_created",
    actorId,
    details: { fieldId: id, name: parsed.name, type: parsed.type },
    projectId: input.projectId,
  });
  return { id };
};

export const createField = (actorId: string, input: CreateCustomFieldInput) =>
  Effect.tryPromise({
    catch: toActionError,
    try: () =>
      db.transaction((transaction) =>
        createInTransaction(transaction, actorId, input)
      ),
  });

// Loads an active field and locks its project, so edits to one project's
// fields take turns.
const lockActiveField = async (transaction: Transaction, fieldId: string) => {
  const field = isUuid(fieldId)
    ? await transaction.orm.public.CustomField.where({ id: fieldId }).first()
    : null;
  if (!field || field.archivedAt) {
    throw notFound("field");
  }
  await lockActiveProject(transaction, field.projectId);
  return field;
};

const updateInTransaction = async (
  transaction: Transaction,
  actorId: string,
  fieldId: string,
  draft: CustomFieldDraft
): Promise<void> => {
  await loadAdminActor(transaction, actorId);
  const field = await lockActiveField(transaction, fieldId);
  const parsed = parseFieldDefinition({ ...draft, type: fieldTypeOf(field) });
  if (!parsed.ok) {
    throw invalid(parsed.message, parsed.field);
  }
  const siblings = await transaction.orm.public.CustomField.where({
    archivedAt: null,
    projectId: field.projectId,
  })
    .select("id", "name")
    .all();
  assertFreeName(siblings, parsed.name, fieldId);
  const unchanged =
    field.name === parsed.name &&
    field.required === draft.required &&
    JSON.stringify(optionsOf(field)) === JSON.stringify(parsed.options ?? []);
  if (unchanged) {
    return;
  }
  await transaction.orm.public.CustomField.where({
    id: fieldId,
  }).updateAndCount({
    name: parsed.name,
    options: parsed.options ? [...parsed.options] : null,
    required: draft.required,
    updatedAt: new Date(),
  });
  await recordActivity(transaction, {
    action: "project.custom_field_updated",
    actorId,
    details: { fieldId, name: parsed.name },
    projectId: field.projectId,
  });
};

export const updateField = (
  actorId: string,
  fieldId: string,
  draft: CustomFieldDraft
) =>
  Effect.tryPromise({
    catch: toActionError,
    try: () =>
      db.transaction((transaction) =>
        updateInTransaction(transaction, actorId, fieldId, draft)
      ),
  });

const archiveInTransaction = async (
  transaction: Transaction,
  actorId: string,
  fieldId: string
): Promise<void> => {
  await loadAdminActor(transaction, actorId);
  const field = isUuid(fieldId)
    ? await transaction.orm.public.CustomField.where({ id: fieldId }).first()
    : null;
  if (!field) {
    throw notFound("field");
  }
  // Archiving twice changes nothing, so a repeat is not an error.
  if (field.archivedAt) {
    return;
  }
  await lockActiveProject(transaction, field.projectId);
  const now = new Date();
  await transaction.orm.public.CustomField.where({
    id: fieldId,
  }).updateAndCount({ archivedAt: now, updatedAt: now });
  await recordActivity(transaction, {
    action: "project.custom_field_archived",
    actorId,
    details: { fieldId, name: field.name },
    projectId: field.projectId,
  });
};

export const archiveField = (actorId: string, fieldId: string) =>
  Effect.tryPromise({
    catch: toActionError,
    try: () =>
      db.transaction((transaction) =>
        archiveInTransaction(transaction, actorId, fieldId)
      ),
  });

const reorderInTransaction = async (
  transaction: Transaction,
  actorId: string,
  projectId: string,
  fieldIds: readonly string[]
): Promise<void> => {
  await loadAdminActor(transaction, actorId);
  await lockActiveProject(transaction, projectId);
  const active = await transaction.orm.public.CustomField.where({
    archivedAt: null,
    projectId,
  })
    .select("id", "position")
    .all();
  const wanted = new Set(fieldIds);
  if (
    wanted.size !== fieldIds.length ||
    wanted.size !== active.length ||
    !active.every(({ id }) => wanted.has(id))
  ) {
    throw invalid("List every active field of the project exactly once.");
  }
  const current = new Map(active.map(({ id, position }) => [id, position]));
  for (const [position, id] of fieldIds.entries()) {
    if (current.get(id) !== position) {
      // Fields are few (at most 20) and each needs its own position.
      // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop
      await transaction.orm.public.CustomField.where({
        id,
      }).updateAndCount({ position, updatedAt: new Date() });
    }
  }
};

export const reorderFields = (
  actorId: string,
  projectId: string,
  fieldIds: readonly string[]
) =>
  Effect.tryPromise({
    catch: toActionError,
    try: () =>
      db.transaction((transaction) =>
        reorderInTransaction(transaction, actorId, projectId, fieldIds)
      ),
  });

// The active fields of one project in display order.
export const listProjectFields = (actorId: string, projectId: string) =>
  Effect.tryPromise({
    catch: toActionError,
    try: async (): Promise<readonly CustomFieldView[]> => {
      await loadStaffActor(db, actorId);
      if (!isUuid(projectId)) {
        throw notFound("project");
      }
      const rows = await db.orm.public.CustomField.where({
        archivedAt: null,
        projectId,
      })
        .orderBy((field) => field.position.asc())
        .all();
      return rows.map(toView);
    },
  });
