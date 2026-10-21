import { randomBytes, randomUUID } from "node:crypto";

import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { severityForImpact } from "../portal/portal-bug-access";
import { createBugReport } from "../work/bug-management";
import { createBugSla } from "../work/bug-sla";
import { announceClientBug } from "../work/bug-workflow-pick";
import type { Transaction } from "../work/work-internal";
import { databaseError } from "../work/work-internal";
import { validateAttachment } from "./intake-attachment";
import type { IntakeAttachment } from "./intake-attachment";
import {
  EXTERNAL_REPORTER_EMAIL,
  EXTERNAL_REPORTER_NAME,
  MAX_DESCRIPTION_LENGTH,
  MAX_MESSAGE_ID_LENGTH,
  MAX_TITLE_LENGTH,
  UNKNOWN_SENDER,
  WEB_RATE_LIMIT,
  WEB_RATE_WINDOW_MS,
  externalReporterId,
  formTokenSecret,
  hashSenderAddress,
} from "./intake-config";
import { checkFormToken } from "./intake-guard";
import {
  buildDescription,
  cleanTitle,
  fieldFailure,
  parseEmailAddress,
  validateWebFields,
} from "./intake-input";
import { IntakeObjectStore } from "./intake-object-store";

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERENCE_LENGTH = 8;
const ACTUAL_BEHAVIOR_LENGTH = 2000;

// The same words for an unknown slug, a disabled form and a deactivated
// company, so a probe learns nothing about which forms exist.
const unavailable = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "This form is not available.",
  });

export interface WebSubmissionInput {
  readonly attachment: IntakeAttachment | null;
  readonly clientIp: string | undefined;
  readonly description: string;
  readonly email: string;
  readonly formToken: string;
  readonly slug: string;
  readonly title: string;
  // The honeypot: real people never see it, so it must come back empty.
  readonly website: string;
}

export interface EmailSubmissionInput {
  readonly from: string;
  readonly messageId: string;
  readonly slug: string;
  readonly subject: string;
  readonly text: string;
}

export interface IntakeReceipt {
  readonly referenceId: string;
}

export interface EmailIntakeReceipt extends IntakeReceipt {
  readonly duplicate: boolean;
}

export interface PublicFormView {
  readonly companyName: string;
  readonly name: string;
}

export const newReferenceId = (): string => {
  const bytes = randomBytes(REFERENCE_LENGTH);
  const code = [...bytes]
    .map((byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length])
    .join("");
  return `INT-${code}`;
};

const loadOpenForm = async (transaction: Transaction, slug: string) => {
  const form = await transaction.orm.public.IntakeForm.where({ slug })
    .select("id", "name", "enabled", "clientCompanyId", "projectId")
    .first();
  if (!form?.enabled) {
    throw unavailable();
  }
  const [company, project] = await Promise.all([
    transaction.orm.public.ClientCompany.where({ id: form.clientCompanyId })
      .select("name", "deactivatedAt")
      .first(),
    transaction.orm.public.Project.where({ id: form.projectId })
      .select("archivedAt")
      .first(),
  ]);
  if (!company || company.deactivatedAt || !project || project.archivedAt) {
    throw unavailable();
  }
  return { ...form, companyName: company.name };
};

type OpenForm = Awaited<ReturnType<typeof loadOpenForm>>;

const ensureExternalReporter = async (
  transaction: Transaction
): Promise<void> => {
  const now = new Date();
  await transaction.orm.public.User.upsert({
    conflictOn: { id: externalReporterId },
    create: {
      banned: true,
      createdAt: now,
      email: EXTERNAL_REPORTER_EMAIL,
      emailNormalized: EXTERNAL_REPORTER_EMAIL,
      emailVerified: false,
      id: externalReporterId,
      mustChangePassword: false,
      name: EXTERNAL_REPORTER_NAME,
      role: "employee",
      updatedAt: now,
    },
    update: { name: EXTERNAL_REPORTER_NAME },
  });
};

interface NewIntakeItem {
  readonly attachment:
    | (IntakeAttachment & { readonly storageKey: string })
    | null;
  readonly description: string;
  readonly email: string;
  readonly messageId: string | null;
  readonly senderHash: string | null;
  readonly source: "email" | "web";
  readonly title: string;
}

// Creates the triage bug, its SLA clock, the submission record and the
// notifications in one transaction, so a failure leaves nothing behind.
const createIntakeItem = async (
  transaction: Transaction,
  form: OpenForm,
  item: NewIntakeItem
): Promise<IntakeReceipt> => {
  await ensureExternalReporter(transaction);
  const via = item.source === "web" ? "web form" : "email";
  const now = new Date();
  const bug = await createBugReport(
    transaction,
    externalReporterId,
    {
      actualBehavior:
        item.description.slice(0, ACTUAL_BEHAVIOR_LENGTH).trim() ||
        "See the description.",
      appVersion: null,
      browser: null,
      component: "Intake",
      description: buildDescription(item.description, {
        email: item.email,
        via,
      }),
      device: null,
      discoverySource: "customer_report",
      environment: "production",
      expectedBehavior: "Not provided by the external reporter.",
      os: null,
      projectId: form.projectId,
      reproductionSteps: ["See the description."],
      route: `Intake ${via}: ${form.name}`,
      severity: severityForImpact.medium,
      title: item.title,
    },
    { clientCompanyId: form.clientCompanyId, clientImpact: "medium" }
  );
  await createBugSla(transaction, { bugId: bug.id, impact: "medium", now });
  const referenceId = newReferenceId();
  await transaction.orm.public.IntakeSubmission.create({
    bugReportId: bug.id,
    createdAt: now,
    formId: form.id,
    id: randomUUID(),
    messageId: item.messageId,
    referenceId,
    reporterEmail: item.email,
    senderHash: item.senderHash,
    source: item.source,
  });
  if (item.attachment) {
    await transaction.orm.public.FileAsset.create({
      contentType: item.attachment.contentType,
      copyState: "ready",
      createdAt: now,
      id: randomUUID(),
      originalName: item.attachment.fileName,
      projectId: form.projectId,
      sizeBytes: BigInt(item.attachment.bytes.byteLength),
      storageKey: item.attachment.storageKey,
      taskId: bug.taskId,
      uploadedById: externalReporterId,
    });
  }
  await announceClientBug(transaction, {
    bugId: bug.id,
    includeAdmins: true,
    now,
    reporterId: externalReporterId,
    text: `New intake report (${via}) for ${form.companyName}`,
  });
  return { referenceId };
};

const assertUnderRateLimit = async (
  transaction: Transaction,
  senderHash: string
): Promise<void> => {
  const since = new Date(Date.now() - WEB_RATE_WINDOW_MS);
  const recent = await transaction.orm.public.IntakeSubmission.where(
    (submission) => submission.senderHash.eq(senderHash)
  )
    .where((submission) => submission.createdAt.gte(since))
    .select("id")
    .all();
  if (recent.length >= WEB_RATE_LIMIT) {
    throw new AppError({
      code: "RATE_LIMITED",
      message: "Too many reports from your network. Try again later.",
    });
  }
};

const failToken = (verdict: "expired" | "invalid" | "too_fast"): AppError =>
  new AppError({
    code: "VALIDATION_FAILED",
    message:
      verdict === "too_fast"
        ? "That was quick. Please review your report and send it again."
        : "This form has expired. Reload the page and try again.",
  });

const storageKeyFor = (formId: string): string =>
  `company/intake/${formId}/${randomUUID()}`;

export class IntakeSubmissions extends Context.Service<
  IntakeSubmissions,
  {
    readonly describeForm: (
      slug: string
    ) => Effect.Effect<PublicFormView, AppError>;
    readonly submitWeb: (
      input: WebSubmissionInput
    ) => Effect.Effect<IntakeReceipt, AppError>;
    readonly submitEmail: (
      input: EmailSubmissionInput
    ) => Effect.Effect<EmailIntakeReceipt, AppError>;
  }
>()("metsys/server/IntakeSubmissions") {}

const findDuplicate = async (formId: string, messageId: string) =>
  await db.orm.public.IntakeSubmission.where({ formId, messageId })
    .select("referenceId")
    .first();

const describeForm = (slug: string) =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        const form = await loadOpenForm(transaction, slug);
        return { companyName: form.companyName, name: form.name };
      }),
  });

const submitEmail = (input: EmailSubmissionInput) =>
  Effect.gen(function* submitEmailReport() {
    const messageId = input.messageId.trim();
    const email = parseEmailAddress(input.from);
    if (!messageId || messageId.length > MAX_MESSAGE_ID_LENGTH) {
      return yield* Effect.fail(
        fieldFailure("messageId", "A valid message id is required.")
      );
    }
    if (!email) {
      return yield* Effect.fail(
        fieldFailure("from", "The sender address is not valid.")
      );
    }
    const form = yield* Effect.tryPromise({
      catch: databaseError,
      try: () =>
        db.transaction((transaction) => loadOpenForm(transaction, input.slug)),
    });
    const title =
      cleanTitle(input.subject).slice(0, MAX_TITLE_LENGTH).trim() ||
      "(no subject)";
    const text = input.text.slice(0, MAX_DESCRIPTION_LENGTH);
    const existing = yield* Effect.tryPromise({
      catch: databaseError,
      try: () => findDuplicate(form.id, messageId),
    });
    if (existing) {
      return { duplicate: true, referenceId: existing.referenceId };
    }
    return yield* Effect.tryPromise({
      catch: (error) => error,
      try: () =>
        db.transaction(async (transaction) => ({
          ...(await createIntakeItem(transaction, form, {
            attachment: null,
            description: text.trim() || "(no text)",
            email,
            messageId,
            senderHash: null,
            source: "email",
            title,
          })),
          duplicate: false,
        })),
    }).pipe(
      Effect.catch((error) =>
        // Two deliveries of one message can race past the check above.
        isUniqueConstraintViolation(error)
          ? Effect.tryPromise({
              catch: databaseError,
              try: async () => {
                const winner = await findDuplicate(form.id, messageId);
                if (!winner) {
                  throw error;
                }
                return { duplicate: true, referenceId: winner.referenceId };
              },
            })
          : Effect.fail(databaseError(error))
      )
    );
  });

export const IntakeSubmissionsLive = Layer.effect(
  IntakeSubmissions,
  Effect.gen(function* makeIntakeSubmissions() {
    const objects = yield* IntakeObjectStore;

    const submitWeb = (input: WebSubmissionInput) =>
      Effect.gen(function* submitWebReport() {
        const form = yield* Effect.tryPromise({
          catch: databaseError,
          try: () =>
            db.transaction((transaction) =>
              loadOpenForm(transaction, input.slug)
            ),
        });
        if (input.website.trim()) {
          // A bot filled the hidden field. Look like success, store nothing.
          return { referenceId: newReferenceId() };
        }
        const verdict = checkFormToken(
          formTokenSecret(),
          input.slug,
          input.formToken,
          Date.now()
        );
        if (verdict !== "ok") {
          return yield* Effect.fail(failToken(verdict));
        }
        const fields = yield* Effect.try({
          catch: databaseError,
          try: () => validateWebFields(input),
        });
        const attachment = input.attachment
          ? yield* Effect.try({
              catch: databaseError,
              try: () =>
                validateAttachment(input.attachment as IntakeAttachment),
            })
          : null;
        const senderHash = hashSenderAddress(input.clientIp ?? UNKNOWN_SENDER);
        const storageKey = attachment ? storageKeyFor(form.id) : null;
        if (attachment && storageKey) {
          yield* objects.put(
            storageKey,
            attachment.contentType,
            attachment.bytes
          );
        }
        return yield* Effect.tryPromise({
          catch: databaseError,
          try: () =>
            db.transaction(async (transaction) => {
              await assertUnderRateLimit(transaction, senderHash);
              return await createIntakeItem(transaction, form, {
                attachment:
                  attachment && storageKey
                    ? { ...attachment, storageKey }
                    : null,
                description: fields.description,
                email: fields.email,
                messageId: null,
                senderHash,
                source: "web",
                title: fields.title,
              });
            }),
        }).pipe(
          Effect.tapError(() =>
            storageKey ? Effect.ignore(objects.remove(storageKey)) : Effect.void
          )
        );
      });

    return IntakeSubmissions.of({ describeForm, submitEmail, submitWeb });
  })
);
