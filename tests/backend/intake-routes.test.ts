import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  externalReporterId,
  issueFormTokenFor,
} from "../../src/server/intake/intake-config";
import { signInboundBody } from "../../src/server/intake/intake-guard";
import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const SECRET = "inbound-secret-for-intake-route-tests-0123456789";
process.env["INTAKE_EMAIL_SECRET"] = SECRET;

const { POST: postEmail } = await import("../../app/api/intake/email/route");
const { POST: postWeb } = await import("../../app/api/intake/[slug]/route");

let slug = "";
let disabledSlug = "";
const formIds: string[] = [];
let ipCounter = 0;

const makeForm = async (formSlug: string, enabled: boolean) => {
  const id = randomUUID();
  formIds.push(id);
  await authPool.query(
    'INSERT INTO intake_form (id, slug, name, "clientCompanyId", "projectId", enabled, "createdById") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      id,
      formSlug,
      "Route form",
      ids.clientCompanyId,
      ids.projectId,
      enabled,
      personaId("admin"),
    ]
  );
};

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, ids.projectId]
  );
  slug = `route-${randomUUID()}`;
  disabledSlug = `route-${randomUUID()}`;
  await makeForm(slug, true);
  await makeForm(disabledSlug, false);
});

afterAll(async () => {
  await authPool.query(
    'DELETE FROM intake_submission WHERE "formId" = ANY($1::uuid[])',
    [formIds]
  );
  await authPool.query("DELETE FROM intake_form WHERE id = ANY($1::uuid[])", [
    formIds,
  ]);
  await teardownHarness();
  for (const statement of [
    'DELETE FROM notification WHERE "actorId" = $1',
    'DELETE FROM activity WHERE "actorId" = $1',
    'DELETE FROM "user" WHERE id = $1',
  ]) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(statement, [externalReporterId]);
  }
});

const submissionCount = async (): Promise<number> => {
  const result = await authPool.query(
    'SELECT count(*)::int AS count FROM intake_submission WHERE "formId" = ANY($1::uuid[])',
    [formIds]
  );
  return result.rows[0].count as number;
};

const emailBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    from: "Pat <pat@example.com>",
    messageId: `<${randomUUID()}@mail.example>`,
    slug,
    subject: "Printer on fire",
    text: "Please help",
    ...overrides,
  });

const emailRequest = (
  body: string,
  options: {
    secret?: string;
    timestamp?: number;
    signature?: string | null;
  } = {}
) => {
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const headers = new Headers({ "content-type": "application/json" });
  headers.set("x-intake-timestamp", timestamp);
  const signature =
    options.signature === undefined
      ? signInboundBody(options.secret ?? SECRET, timestamp, body)
      : options.signature;
  if (signature !== null) {
    headers.set("x-intake-signature", signature);
  }
  return new Request("http://localhost/api/intake/email", {
    body,
    headers,
    method: "POST",
  });
};

it("accepts a correctly signed email once and reports the repeat as a duplicate", async () => {
  const body = emailBody();
  const first = await postEmail(emailRequest(body));
  expect(first.status).toBe(201);
  const created = (await first.json()) as {
    duplicate: boolean;
    referenceId: string;
  };
  expect(created.duplicate).toBe(false);
  const again = await postEmail(emailRequest(body));
  expect(again.status).toBe(200);
  expect(await again.json()).toEqual({
    duplicate: true,
    referenceId: created.referenceId,
  });
});

it("rejects a bad signature, a missing signature and the wrong secret without creating anything", async () => {
  const before = await submissionCount();
  const body = emailBody();
  const responses = await Promise.all([
    postEmail(emailRequest(body, { signature: "0".repeat(64) })),
    postEmail(emailRequest(body, { signature: null })),
    postEmail(
      emailRequest(body, { secret: "another-secret-another-secret-9999" })
    ),
    postEmail(
      emailRequest(`${body} `, {
        signature: signInboundBody(
          SECRET,
          String(Math.floor(Date.now() / 1000)),
          body
        ),
      })
    ),
  ]);
  expect(responses.map((response) => response.status)).toEqual([
    401, 401, 401, 401,
  ]);
  expect(await submissionCount()).toBe(before);
});

it("rejects a replayed request outside the time window", async () => {
  const before = await submissionCount();
  const body = emailBody();
  const old = Math.floor(Date.now() / 1000) - 3600;
  const response = await postEmail(emailRequest(body, { timestamp: old }));
  expect(response.status).toBe(401);
  expect(await submissionCount()).toBe(before);
});

it("rejects an oversize or malformed inbound body", async () => {
  const before = await submissionCount();
  const huge = emailBody({ text: "x".repeat(70_000) });
  const tooBig = await postEmail(emailRequest(huge));
  expect(tooBig.status).toBe(413);
  const notJson = await postEmail(emailRequest("{not json"));
  expect(notJson.status).toBe(400);
  const missing = await postEmail(emailRequest(JSON.stringify({ slug })));
  expect(missing.status).toBe(400);
  expect(await submissionCount()).toBe(before);
});

it("answers email for an unknown or disabled form with the same 404", async () => {
  const unknown = await postEmail(
    emailRequest(emailBody({ slug: "no-such-form" }))
  );
  const disabled = await postEmail(
    emailRequest(emailBody({ slug: disabledSlug }))
  );
  expect(unknown.status).toBe(404);
  expect(disabled.status).toBe(404);
  expect(await disabled.text()).toBe(await unknown.text());
});

it("is switched off when no inbound secret is configured", async () => {
  delete process.env["INTAKE_EMAIL_SECRET"];
  try {
    const response = await postEmail(emailRequest(emailBody()));
    expect(response.status).toBe(404);
  } finally {
    process.env["INTAKE_EMAIL_SECRET"] = SECRET;
  }
});

const webRequest = (
  formSlug: string,
  fields: Record<string, string | File>,
  ip = `203.0.113.${(ipCounter += 1)}`
) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }
  return {
    context: { params: Promise.resolve({ slug: formSlug }) },
    request: new Request(`http://localhost/api/intake/${formSlug}`, {
      body: form,
      headers: { "x-forwarded-for": ip },
      method: "POST",
    }),
  };
};

const goodFields = (formSlug = slug): Record<string, string> => ({
  description: "It does not work.",
  email: "visitor@example.com",
  formToken: issueFormTokenFor(formSlug, Date.now() - 10_000),
  title: "Broken thing",
  website: "",
});

const sendWeb = (
  formSlug: string,
  fields: Record<string, string | File>,
  ip?: string
) => {
  const { context, request } = webRequest(formSlug, fields, ip);
  return postWeb(request, context);
};

it("creates a bug from the public form and returns a reference", async () => {
  const response = await sendWeb(slug, goodFields());
  expect(response.status).toBe(201);
  const { referenceId } = (await response.json()) as { referenceId: string };
  expect(referenceId).toMatch(/^INT-/u);
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("answers the public form for an unknown slug and a disabled form identically", async () => {
  const before = await submissionCount();
  const unknown = await sendWeb("zzz-unknown", goodFields("zzz-unknown"));
  const disabled = await sendWeb(disabledSlug, goodFields(disabledSlug));
  expect(unknown.status).toBe(404);
  expect(disabled.status).toBe(404);
  expect(await disabled.text()).toBe(await unknown.text());
  expect(await submissionCount()).toBe(before);
});

it("reports field errors with 422 and throttles with 429", async () => {
  const bad = await sendWeb(slug, { ...goodFields(), title: "" });
  expect(bad.status).toBe(422);
  const body = (await bad.json()) as {
    error: { fieldErrors: Record<string, string> };
  };
  expect(body.error.fieldErrors["title"]).toBeDefined();

  const ip = "198.51.100.250";
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await sendWeb(slug, goodFields(), ip);
    statuses.push(response.status);
  }
  expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
});

it("rejects an oversize upload with 413 before reading it", async () => {
  const before = await submissionCount();
  const { context, request } = webRequest(slug, goodFields());
  const huge = new Request(request.url, {
    body: request.body,
    duplex: "half",
    headers: {
      "content-length": String(50 * 1024 * 1024),
      "content-type": request.headers.get("content-type") ?? "",
      "x-forwarded-for": "203.0.113.99",
    },
    method: "POST",
  } as RequestInit);
  const response = await postWeb(huge, context);
  expect(response.status).toBe(413);
  expect(await submissionCount()).toBe(before);
});

it("rejects a disallowed attachment type with 422", async () => {
  const before = await submissionCount();
  const response = await sendWeb(slug, {
    ...goodFields(),
    attachment: new File(["<svg onload=alert(1)>"], "x.svg", {
      type: "image/svg+xml",
    }),
  });
  expect(response.status).toBe(422);
  expect(await submissionCount()).toBe(before);
});

it("swallows a honeypot hit as a success without storing anything", async () => {
  const before = await submissionCount();
  const response = await sendWeb(slug, {
    ...goodFields(),
    website: "http://spam.example",
  });
  expect(response.status).toBe(201);
  expect(await submissionCount()).toBe(before);
});
