import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Exit, Layer } from "effect";

import type { AppError } from "../../src/server/core/action-result";
import {
  externalReporterId,
  issueFormTokenFor,
} from "../../src/server/intake/intake-config";
import type { IntakeObjectStoreApi } from "../../src/server/intake/intake-object-store";
import { IntakeObjectStore } from "../../src/server/intake/intake-object-store";
import {
  IntakeSubmissions,
  IntakeSubmissionsLive,
} from "../../src/server/intake/intake-submissions";
import {
  authPool,
  callAs,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const peopleQueries = await import("../../features/people/people-queries");

const putObjects: { key: string; contentType: string; size: number }[] = [];
const fakeStore: IntakeObjectStoreApi = {
  put: (key, contentType, bytes) =>
    Effect.sync(() => {
      putObjects.push({ contentType, key, size: bytes.byteLength });
    }),
  remove: () => Effect.void,
};
const layer = Layer.provide(
  IntakeSubmissionsLive,
  Layer.succeed(IntakeObjectStore, IntakeObjectStore.of(fakeStore))
);

const run = <Value>(
  program: (
    service: typeof IntakeSubmissions.Service
  ) => Effect.Effect<Value, AppError>
) =>
  Effect.runPromiseExit(
    Effect.provide(
      Effect.gen(function* withService() {
        return yield* program(yield* IntakeSubmissions);
      }),
      layer
    )
  );

const failure = (exit: Exit.Exit<unknown, AppError>): AppError => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected the intake to fail.");
  }
  const reason = exit.cause.reasons.find((item) => item._tag === "Fail");
  if (!reason || reason._tag !== "Fail") {
    throw new Error("Expected a typed failure.");
  }
  return reason.error;
};

const success = <Value>(exit: Exit.Exit<Value, AppError>): Value => {
  if (!Exit.isSuccess(exit)) {
    throw new Error(`Expected success but got ${failure(exit).message}`);
  }
  return exit.value;
};

let slug = "";
let formId = "";
let disabledSlug = "";
let disabledFormId = "";
let otherIpCounter = 0;

const makeForm = async (formSlug: string, enabled: boolean) => {
  const id = randomUUID();
  await authPool.query(
    'INSERT INTO intake_form (id, slug, name, "clientCompanyId", "projectId", enabled, "createdById") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      id,
      formSlug,
      "Support intake",
      ids.clientCompanyId,
      ids.projectId,
      enabled,
      personaId("admin"),
    ]
  );
  return id;
};

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, ids.projectId]
  );
  slug = `slug-${randomUUID()}`;
  disabledSlug = `slug-${randomUUID()}`;
  formId = await makeForm(slug, true);
  disabledFormId = await makeForm(disabledSlug, false);
});

afterAll(async () => {
  await authPool.query(
    'DELETE FROM intake_submission WHERE "formId" = ANY($1::uuid[])',
    [[formId, disabledFormId]]
  );
  await authPool.query("DELETE FROM intake_form WHERE id = ANY($1::uuid[])", [
    [formId, disabledFormId],
  ]);
  await teardownHarness();
  // The external reporter is created on first use, so a test run removes it.
  for (const statement of [
    'DELETE FROM notification WHERE "actorId" = $1',
    'DELETE FROM activity WHERE "actorId" = $1',
    'DELETE FROM file_asset WHERE "uploadedById" = $1',
    'DELETE FROM "user" WHERE id = $1',
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(statement, [externalReporterId]);
  }
});

const freshIp = () => {
  otherIpCounter += 1;
  return `198.51.100.${otherIpCounter}`;
};

const webInput = (overrides: Record<string, unknown> = {}) => ({
  attachment: null,
  clientIp: freshIp(),
  description: "The export button does nothing.",
  email: "reporter@example.com",
  formToken: issueFormTokenFor(slug, Date.now() - 10_000),
  slug,
  title: "Export is broken",
  website: "",
  ...overrides,
});

const countBugs = async (): Promise<number> => {
  const result = await authPool.query(
    'SELECT count(*)::int AS count FROM intake_submission WHERE "formId" = $1',
    [formId]
  );
  return result.rows[0].count as number;
};

it("turns a web submission into a reported client bug from the external reporter", async () => {
  const receipt = success(
    await run((service) => service.submitWeb(webInput()))
  );
  expect(receipt.referenceId).toMatch(/^INT-[A-Z0-9]{8}$/u);

  const bug = await authPool.query(
    `SELECT b.status, b."reporterId", b."clientCompanyId", b."projectId", b."discoverySource", t.title, t.type
       FROM intake_submission s JOIN bug_report b ON b.id = s."bugReportId" JOIN task t ON t.id = b."taskId"
      WHERE s."referenceId" = $1`,
    [receipt.referenceId]
  );
  expect(bug.rows).toHaveLength(1);
  expect(bug.rows[0]).toMatchObject({
    clientCompanyId: ids.clientCompanyId,
    discoverySource: "customer_report",
    projectId: ids.projectId,
    reporterId: externalReporterId,
    status: "reported",
    title: "Export is broken",
    type: "bug",
  });

  const reporter = await authPool.query(
    'SELECT role, banned, "mustChangePassword" FROM "user" WHERE id = $1',
    [externalReporterId]
  );
  expect(reporter.rows[0]).toMatchObject({ banned: true, role: "employee" });
  const accounts = await authPool.query(
    'SELECT count(*)::int AS count FROM account WHERE "userId" = $1',
    [externalReporterId]
  );
  expect(accounts.rows[0].count).toBe(0);
});

it("keeps the external reporter out of the people directory", async () => {
  success(
    await run((service) =>
      service.submitWeb(webInput({ title: "Directory check" }))
    )
  );
  const listed = await callAs("admin", peopleQueries.listEmployees, {
    search: "",
  });
  expect(listed.ok).toBe(true);
  expect(
    listed.ok &&
      listed.data.some(
        (person: { id: string }) => person.id === externalReporterId
      )
  ).toBe(false);
});

it("tells the admins in the app about a new intake item", async () => {
  const receipt = success(
    await run((service) =>
      service.submitWeb(webInput({ title: "Notify admins" }))
    )
  );
  const notices = await authPool.query(
    `SELECT n.text FROM notification n
       JOIN bug_report b ON b."taskId" = n."taskId"
       JOIN intake_submission s ON s."bugReportId" = b.id
      WHERE s."referenceId" = $1 AND n."userId" = $2`,
    [receipt.referenceId, personaId("admin")]
  );
  expect(notices.rows).toHaveLength(1);
  expect(notices.rows[0].text).toContain("intake");
});

it("answers an unknown slug and a disabled form with the same not-found error", async () => {
  const before = await countBugs();
  const unknown = failure(
    await run((service) =>
      service.submitWeb(webInput({ slug: "no-such-form-slug" }))
    )
  );
  const disabled = failure(
    await run((service) => service.submitWeb(webInput({ slug: disabledSlug })))
  );
  expect(unknown.code).toBe("NOT_FOUND");
  expect({ code: disabled.code, message: disabled.message }).toEqual({
    code: unknown.code,
    message: unknown.message,
  });
  expect(await countBugs()).toBe(before);
  const form = failure(
    await run((service) => service.describeForm(disabledSlug))
  );
  expect(form.message).toBe(unknown.message);
});

it("silently drops a submission that fills the honeypot", async () => {
  const before = await countBugs();
  const receipt = success(
    await run((service) =>
      service.submitWeb(webInput({ website: "https://spam.example" }))
    )
  );
  expect(receipt.referenceId).toMatch(/^INT-/u);
  expect(await countBugs()).toBe(before);
});

it("refuses a form that was sent too quickly or without a valid token", async () => {
  const before = await countBugs();
  const fast = failure(
    await run((service) =>
      service.submitWeb(
        webInput({ formToken: issueFormTokenFor(slug, Date.now()) })
      )
    )
  );
  const forged = failure(
    await run((service) => service.submitWeb(webInput({ formToken: "1.abc" })))
  );
  const wrongForm = failure(
    await run((service) =>
      service.submitWeb(
        webInput({ formToken: issueFormTokenFor("other", Date.now() - 10_000) })
      )
    )
  );
  for (const error of [fast, forged, wrongForm]) {
    expect(error.code).toBe("VALIDATION_FAILED");
  }
  expect(await countBugs()).toBe(before);
});

it("enforces strict length and format limits on every field", async () => {
  const before = await countBugs();
  const cases: [string, Record<string, unknown>][] = [
    ["title", { title: "t".repeat(151) }],
    ["title", { title: "   " }],
    ["description", { description: "d".repeat(5001) }],
    ["description", { description: "" }],
    ["email", { email: `${"a".repeat(250)}@example.com` }],
    ["email", { email: "not-an-email" }],
  ];
  for (const [field, override] of cases) {
    // eslint-disable-next-line no-await-in-loop
    const error = failure(
      await run((service) => service.submitWeb(webInput(override)))
    );
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fieldErrors?.[field]).toBeDefined();
  }
  expect(await countBugs()).toBe(before);
});

it("rate limits repeat submissions from one address", async () => {
  const ip = "203.0.113.200";
  const before = await countBugs();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const input = webInput({ clientIp: ip, title: `Burst ${attempt}` });
    // eslint-disable-next-line no-await-in-loop
    const exit = await run((service) => service.submitWeb(input));
    success(exit);
  }
  const blocked = failure(
    await run((service) => service.submitWeb(webInput({ clientIp: ip })))
  );
  expect(blocked.code).toBe("RATE_LIMITED");
  expect(await countBugs()).toBe(before + 5);
  // Another address is unaffected.
  success(await run((service) => service.submitWeb(webInput())));
  const hashes = await authPool.query(
    'SELECT "senderHash" FROM intake_submission WHERE "formId" = $1 AND "senderHash" IS NOT NULL',
    [formId]
  );
  expect(hashes.rows.map((row) => row.senderHash as string)).not.toContain(ip);
});

it("neutralises script and markup payloads in the title, description and email", async () => {
  const payload = "<script>alert(1)</script><img src=x onerror=alert(2)>";
  const receipt = success(
    await run((service) =>
      service.submitWeb(
        webInput({
          description: `${payload} [x](javascript:alert(3)) <a href="javascript:alert(4)">go</a>`,
          title: payload,
        })
      )
    )
  );
  const stored = await authPool.query(
    `SELECT t.title, t.description, b.description AS "bugDescription"
       FROM intake_submission s JOIN bug_report b ON b.id = s."bugReportId" JOIN task t ON t.id = b."taskId"
      WHERE s."referenceId" = $1`,
    [receipt.referenceId]
  );
  const row = stored.rows[0] as Record<string, string>;
  for (const value of [row["title"], row["description"]]) {
    expect(value).not.toMatch(/<(?:script|img|a\s)/iu);
  }
  expect(row["title"]).not.toMatch(/[<>]/u);
  expect(row["description"]).not.toMatch(/<(?!\/?(?:p|br|strong|a)\b)/u);
  const failed = failure(
    await run((service) =>
      service.submitWeb(webInput({ email: '"><script>@example.com' }))
    )
  );
  expect(failed.code).toBe("VALIDATION_FAILED");
});

it("stores an allowed attachment on the bug and rejects unsafe ones", async () => {
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
  ]);
  const receipt = success(
    await run((service) =>
      service.submitWeb(
        webInput({
          attachment: {
            bytes: png,
            contentType: "image/png",
            fileName: "shot.png",
          },
        })
      )
    )
  );
  const files = await authPool.query(
    `SELECT f."originalName", f."contentType", f."uploadedById", f."sizeBytes"::int AS size
       FROM intake_submission s JOIN bug_report b ON b.id = s."bugReportId" JOIN file_asset f ON f."taskId" = b."taskId"
      WHERE s."referenceId" = $1`,
    [receipt.referenceId]
  );
  expect(files.rows).toEqual([
    {
      contentType: "image/png",
      originalName: "shot.png",
      size: png.byteLength,
      uploadedById: externalReporterId,
    },
  ]);
  expect(putObjects.at(-1)?.contentType).toBe("image/png");

  const before = await countBugs();
  const attempts = [
    { bytes: png, contentType: "image/svg+xml", fileName: "a.svg" },
    { bytes: png, contentType: "text/html", fileName: "a.html" },
    // Declared as an image but not one.
    {
      bytes: Uint8Array.from([60, 104, 116, 109, 108, 62]),
      contentType: "image/png",
      fileName: "fake.png",
    },
    {
      bytes: new Uint8Array(5 * 1024 * 1024 + 1),
      contentType: "text/plain",
      fileName: "big.txt",
    },
    { bytes: new Uint8Array(0), contentType: "text/plain", fileName: "e.txt" },
  ];
  for (const attachment of attempts) {
    const input = webInput({ attachment });
    // eslint-disable-next-line no-await-in-loop
    const exit = await run((service) => service.submitWeb(input));
    const error = failure(exit);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fieldErrors?.["attachment"]).toBeDefined();
  }
  expect(await countBugs()).toBe(before);
});

it("creates a bug from an inbound email once per message id", async () => {
  const messageId = `<${randomUUID()}@mail.example>`;
  const input = {
    from: "Dana Reporter <dana@example.com>",
    messageId,
    slug,
    subject: "Login page crashes",
    text: "Crashes on submit.\n\n<script>alert(1)</script>",
  };
  const first = success(await run((service) => service.submitEmail(input)));
  const again = success(await run((service) => service.submitEmail(input)));
  expect(first.duplicate).toBe(false);
  expect(again).toEqual({ duplicate: true, referenceId: first.referenceId });

  const rows = await authPool.query(
    `SELECT s.source, s."reporterEmail", b.status, b."reporterId", t.title, t.description
       FROM intake_submission s JOIN bug_report b ON b.id = s."bugReportId" JOIN task t ON t.id = b."taskId"
      WHERE s."messageId" = $1`,
    [messageId]
  );
  expect(rows.rows).toHaveLength(1);
  expect(rows.rows[0]).toMatchObject({
    reporterEmail: "dana@example.com",
    reporterId: externalReporterId,
    source: "email",
    status: "reported",
    title: "Login page crashes",
  });
  expect(rows.rows[0].description).not.toContain("<script");
});

it("rejects inbound email for unknown or disabled forms and malformed senders", async () => {
  const base = {
    from: "dana@example.com",
    messageId: `<${randomUUID()}@mail.example>`,
    subject: "Hi",
    text: "Body",
  };
  const before = await countBugs();
  expect(
    failure(
      await run((service) =>
        service.submitEmail({ ...base, slug: "unknown-slug" })
      )
    ).code
  ).toBe("NOT_FOUND");
  expect(
    failure(
      await run((service) =>
        service.submitEmail({ ...base, slug: disabledSlug })
      )
    ).code
  ).toBe("NOT_FOUND");
  expect(
    failure(
      await run((service) =>
        service.submitEmail({ ...base, from: "nobody", slug })
      )
    ).code
  ).toBe("VALIDATION_FAILED");
  expect(await countBugs()).toBe(before);
});

it("truncates an overlong inbound subject and body to the stored limits", async () => {
  const receipt = success(
    await run((service) =>
      service.submitEmail({
        from: "dana@example.com",
        messageId: `<${randomUUID()}@mail.example>`,
        slug,
        subject: "s".repeat(400),
        text: "b".repeat(20_000),
      })
    )
  );
  const row = await authPool.query(
    `SELECT length(t.title) AS "titleLength", length(t.description) AS "descriptionLength"
       FROM intake_submission s JOIN bug_report b ON b.id = s."bugReportId" JOIN task t ON t.id = b."taskId"
      WHERE s."referenceId" = $1`,
    [receipt.referenceId]
  );
  expect(row.rows[0].titleLength).toBeLessThanOrEqual(150);
  expect(row.rows[0].descriptionLength).toBeLessThan(5600);
});
