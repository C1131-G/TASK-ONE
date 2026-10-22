import { randomBytes, randomUUID } from "node:crypto";

import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { databaseError } from "../work/work-internal";
import type { Transaction } from "../work/work-internal";
import type {
  CreateIntakeFormInput,
  IntakeFormItem,
  IntakeFormReceipt,
  IntakeFormVersionInput,
  SetIntakeFormEnabledInput,
} from "./intake-form-contracts";
import {
  CreateIntakeFormInputSchema,
  IntakeFormVersionInputSchema,
  SetIntakeFormEnabledInputSchema,
} from "./intake-form-contracts";

// 16 random bytes: 128 bits, far beyond guessing, in 22 URL-safe characters.
const SLUG_BYTES = 16;
const newSlug = (): string => randomBytes(SLUG_BYTES).toString("base64url");

const invalid = (message: string): AppError =>
  new AppError({ code: "VALIDATION_FAILED", message });

const requireAdmin = async (
  transaction: Transaction,
  actorId: string
): Promise<void> => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("role", "deactivatedAt")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
};

const conflict = (): never => {
  throw new AppError({
    code: "CONFLICT",
    message: "The intake form changed. Refresh and try again.",
  });
};

const loadForm = async (transaction: Transaction, formId: string) => {
  const form = await transaction.orm.public.IntakeForm.where({
    id: formId,
  }).first();
  if (!form) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The intake form was not found.",
    });
  }
  return form;
};

// Bumps the version as a compare-and-set so two admins cannot both win.
const updateForm = async (
  transaction: Transaction,
  form: { readonly id: string; readonly version: number },
  expectedVersion: number,
  changes: { readonly enabled?: boolean; readonly slug?: string }
): Promise<IntakeFormReceipt> => {
  if (form.version !== expectedVersion) {
    conflict();
  }
  const version = form.version + 1;
  const slug = changes.slug ?? "";
  const updated = await transaction.orm.public.IntakeForm.where({
    id: form.id,
    version: form.version,
  }).updateAndCount({ ...changes, updatedAt: new Date(), version });
  if (!updated) {
    conflict();
  }
  const current = await loadForm(transaction, form.id);
  return { formId: form.id, slug: slug || current.slug, version };
};

const run = <Output>(
  operation: (transaction: Transaction) => Promise<Output>
): Effect.Effect<Output, AppError> =>
  Effect.tryPromise({
    catch: (error) =>
      Schema.isSchemaError(error)
        ? invalid("Check the form and try again.")
        : databaseError(error),
    try: () => db.transaction(operation),
  });

const create = async (
  transaction: Transaction,
  actorId: string,
  rawInput: CreateIntakeFormInput
): Promise<IntakeFormReceipt> => {
  const input = Schema.decodeUnknownSync(CreateIntakeFormInputSchema)(rawInput);
  await requireAdmin(transaction, actorId);
  const [company, project, link] = await Promise.all([
    transaction.orm.public.ClientCompany.where({ id: input.clientCompanyId })
      .select("deactivatedAt")
      .first(),
    transaction.orm.public.Project.where({ id: input.projectId })
      .select("archivedAt")
      .first(),
    transaction.orm.public.ClientCompanyProject.where({
      companyId: input.clientCompanyId,
      projectId: input.projectId,
      removedAt: null,
    })
      .select("id")
      .first(),
  ]);
  if (!company || company.deactivatedAt) {
    throw invalid("Choose an active client company.");
  }
  if (!project || project.archivedAt || !link) {
    throw invalid("Choose an active project shared with that company.");
  }
  const id = randomUUID();
  const slug = newSlug();
  const now = new Date();
  await transaction.orm.public.IntakeForm.create({
    clientCompanyId: input.clientCompanyId,
    createdAt: now,
    createdById: actorId,
    enabled: true,
    id,
    name: input.name,
    projectId: input.projectId,
    slug,
    updatedAt: now,
    version: 1,
  });
  return { formId: id, slug, version: 1 };
};

const list = async (
  transaction: Transaction,
  actorId: string
): Promise<readonly IntakeFormItem[]> => {
  await requireAdmin(transaction, actorId);
  const forms = await transaction.orm.public.IntakeForm.orderBy((form) =>
    form.createdAt.desc()
  )
    .limit(200)
    .all();
  return await Promise.all(
    forms.map(async (form) => {
      const [company, project, submissions] = await Promise.all([
        transaction.orm.public.ClientCompany.where({ id: form.clientCompanyId })
          .select("name")
          .first(),
        transaction.orm.public.Project.where({ id: form.projectId })
          .select("key", "name")
          .first(),
        transaction.orm.public.IntakeSubmission.where({ formId: form.id })
          .select("createdAt")
          .orderBy((submission) => submission.createdAt.desc())
          .limit(1000)
          .all(),
      ]);
      return {
        clientCompanyId: form.clientCompanyId,
        companyName: company?.name ?? "Unknown company",
        createdAt: form.createdAt.toISOString(),
        enabled: form.enabled,
        id: form.id,
        lastSubmissionAt: submissions[0]?.createdAt.toISOString() ?? null,
        name: form.name,
        projectId: form.projectId,
        projectKey: project?.key ?? "",
        projectName: project?.name ?? "Unknown project",
        slug: form.slug,
        submissionCount: submissions.length,
        version: form.version,
      };
    })
  );
};

export class IntakeFormManagement extends Context.Service<
  IntakeFormManagement,
  {
    readonly list: (
      actorId: string
    ) => Effect.Effect<readonly IntakeFormItem[], AppError>;
    readonly create: (
      actorId: string,
      input: CreateIntakeFormInput
    ) => Effect.Effect<IntakeFormReceipt, AppError>;
    readonly rotate: (
      actorId: string,
      input: IntakeFormVersionInput
    ) => Effect.Effect<IntakeFormReceipt, AppError>;
    readonly setEnabled: (
      actorId: string,
      input: SetIntakeFormEnabledInput
    ) => Effect.Effect<IntakeFormReceipt, AppError>;
  }
>()("metsys/server/IntakeFormManagement") {}

export const IntakeFormManagementLive = Layer.succeed(
  IntakeFormManagement,
  IntakeFormManagement.of({
    create: (actorId, input) =>
      run((transaction) => create(transaction, actorId, input)),
    list: (actorId) => run((transaction) => list(transaction, actorId)),
    rotate: (actorId, rawInput) =>
      run(async (transaction) => {
        const input = Schema.decodeUnknownSync(IntakeFormVersionInputSchema)(
          rawInput
        );
        await requireAdmin(transaction, actorId);
        const form = await loadForm(transaction, input.formId);
        return await updateForm(transaction, form, input.expectedVersion, {
          slug: newSlug(),
        });
      }),
    setEnabled: (actorId, rawInput) =>
      run(async (transaction) => {
        const input = Schema.decodeUnknownSync(SetIntakeFormEnabledInputSchema)(
          rawInput
        );
        await requireAdmin(transaction, actorId);
        const form = await loadForm(transaction, input.formId);
        return await updateForm(transaction, form, input.expectedVersion, {
          enabled: input.enabled,
        });
      }),
  })
);
