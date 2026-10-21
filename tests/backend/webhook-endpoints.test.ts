import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  WebhookManagement,
  WebhookManagementLive,
} from "../../src/server/webhooks/webhook-management";
import { decryptSecret } from "../../src/server/webhooks/webhook-secret";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const run = <Value, Failure>(
  program: (
    service: WebhookManagement["Service"]
  ) => Effect.Effect<Value, Failure>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* use() {
        return yield* program(yield* WebhookManagement);
      }),
      WebhookManagementLive
    )
  );

const failure = <Value>(
  program: (
    service: WebhookManagement["Service"]
  ) => Effect.Effect<Value, { readonly code: string }>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* use() {
        const service = yield* WebhookManagement;
        return yield* Effect.flip(program(service));
      }),
      WebhookManagementLive
    )
  );

const adminId = randomUUID();
const employeeId = randomUUID();
const domain = "webhook-endpoints.example";

const insertUser = (id: string, role: string) =>
  authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [id, `User ${role}`, `${id}@${domain}`, role]
  );

beforeAll(async () => {
  await insertUser(adminId, "admin");
  await insertUser(employeeId, "employee");
});

afterAll(async () => {
  await authPool.query(
    'DELETE FROM webhook_endpoint WHERE "createdById" IN ($1, $2)',
    [adminId, employeeId]
  );
  await authPool.query('DELETE FROM activity WHERE "actorId" IN ($1, $2)', [
    adminId,
    employeeId,
  ]);
  await authPool.query('DELETE FROM "user" WHERE email LIKE $1', [
    `%@${domain}`,
  ]);
});

const genericInput = {
  events: ["task.created", "comment.added"] as const,
  kind: "generic" as const,
  name: "Build bot",
  url: "https://hooks.example.com/metsys?token=abc",
};

it("shows the signing secret once and stores it encrypted", async () => {
  const created = await run((service) =>
    service.create(adminId, {
      ...genericInput,
      events: [...genericInput.events],
    })
  );
  expect(created.secret?.startsWith("whsec_")).toBe(true);
  expect(created.endpoint).toMatchObject({
    enabled: true,
    events: ["task.created", "comment.added"],
    kind: "generic",
    name: "Build bot",
  });
  expect(JSON.stringify(created.endpoint)).not.toContain(created.secret ?? "");
  // The query string can carry a token, so the display form drops it.
  expect(created.endpoint.displayUrl).toBe("https://hooks.example.com/metsys");

  const row = await authPool.query<{
    secretCiphertext: string;
    secretHint: string;
  }>(
    'SELECT "secretCiphertext", "secretHint" FROM webhook_endpoint WHERE id = $1',
    [created.endpoint.id]
  );
  const [stored] = row.rows;
  expect(stored?.secretCiphertext).not.toContain(created.secret ?? "");
  expect(
    decryptSecret(
      stored?.secretCiphertext ?? "",
      process.env["BETTER_AUTH_SECRET"] ?? ""
    )
  ).toBe(created.secret ?? "");
  expect(stored?.secretHint).toBe(created.secret?.slice(-4));

  const listed = await run((service) => service.list(adminId));
  const found = listed.find(({ id }) => id === created.endpoint.id);
  expect(found?.secretHint).toBe(stored?.secretHint ?? "");
  expect(JSON.stringify(listed)).not.toContain(created.secret ?? "");
});

it("rotates the secret and invalidates the old one", async () => {
  const created = await run((service) =>
    service.create(adminId, { ...genericInput, events: ["task.created"] })
  );
  const rotated = await run((service) =>
    service.rotateSecret(adminId, created.endpoint.id)
  );
  expect(rotated.secret).not.toBe(created.secret ?? "");
  const row = await authPool.query<{ secretCiphertext: string }>(
    'SELECT "secretCiphertext" FROM webhook_endpoint WHERE id = $1',
    [created.endpoint.id]
  );
  expect(
    decryptSecret(
      row.rows[0]?.secretCiphertext ?? "",
      process.env["BETTER_AUTH_SECRET"] ?? ""
    )
  ).toBe(rotated.secret);
});

it("creates a Slack endpoint without a secret and only for Slack hosts", async () => {
  const created = await run((service) =>
    service.create(adminId, {
      events: ["project.created"],
      kind: "slack",
      name: "Team channel",
      url: "https://hooks.slack.com/services/T000/B000/XXXXXXXX",
    })
  );
  expect(created.secret).toBeNull();
  expect(created.endpoint.displayUrl).toBe(
    "https://hooks.slack.com/services/…"
  );
  const rotation = await failure((service) =>
    service.rotateSecret(adminId, created.endpoint.id)
  );
  expect(rotation.code).toBe("VALIDATION_FAILED");

  const wrongHost = await failure((service) =>
    service.create(adminId, {
      events: ["project.created"],
      kind: "slack",
      name: "Not Slack",
      url: "https://evil.example.com/services/T000/B000/XXXXXXXX",
    })
  );
  expect(wrongHost.code).toBe("VALIDATION_FAILED");
});

it("rejects unsafe URLs, including plain HTTP in production", async () => {
  const unsafe = [
    "https://127.0.0.1/hook",
    "https://169.254.169.254/latest/meta-data/",
    "https://10.0.0.4/hook",
    "https://localhost/hook",
    "https://user:pass@hooks.example.com/hook",
    "ftp://hooks.example.com/hook",
  ];
  for (const url of unsafe) {
    // eslint-disable-next-line no-await-in-loop
    const error = await failure((service) =>
      service.create(adminId, {
        ...genericInput,
        events: ["task.created"],
        url,
      })
    );
    expect(error.code).toBe("VALIDATION_FAILED");
  }
  const previous = process.env["NODE_ENV"] ?? "test";
  Object.assign(process.env, { NODE_ENV: "production" });
  try {
    const error = await failure((service) =>
      service.create(adminId, {
        ...genericInput,
        events: ["task.created"],
        url: "http://hooks.example.com/hook",
      })
    );
    expect(error.code).toBe("VALIDATION_FAILED");
  } finally {
    Object.assign(process.env, { NODE_ENV: previous });
  }
});

it("requires at least one known event", async () => {
  const none = await failure((service) =>
    service.create(adminId, { ...genericInput, events: [] })
  );
  expect(none.code).toBe("VALIDATION_FAILED");
});

it("updates, disables and removes an endpoint", async () => {
  const created = await run((service) =>
    service.create(adminId, { ...genericInput, events: ["task.created"] })
  );
  const updated = await run((service) =>
    service.update(adminId, created.endpoint.id, {
      enabled: false,
      events: ["project.created", "bug.status_changed"],
      name: "Renamed",
      url: "https://hooks.example.com/other",
    })
  );
  expect(updated).toMatchObject({
    displayUrl: "https://hooks.example.com/other",
    enabled: false,
    events: ["project.created", "bug.status_changed"],
    name: "Renamed",
  });
  // Without a URL the stored one is kept (the list never shows its query).
  const kept = await run((service) =>
    service.update(adminId, created.endpoint.id, {
      enabled: true,
      events: ["task.created"],
      name: "Kept URL",
    })
  );
  expect(kept.displayUrl).toBe("https://hooks.example.com/other");
  const badUpdate = await failure((service) =>
    service.update(adminId, created.endpoint.id, {
      enabled: true,
      events: ["task.created"],
      name: "Renamed",
      url: "https://192.168.0.9/hook",
    })
  );
  expect(badUpdate.code).toBe("VALIDATION_FAILED");

  await run((service) => service.remove(adminId, created.endpoint.id));
  const gone = await failure((service) =>
    service.update(adminId, created.endpoint.id, {
      enabled: true,
      events: ["task.created"],
      name: "Renamed",
      url: "https://hooks.example.com/other",
    })
  );
  expect(gone.code).toBe("NOT_FOUND");
});

it("refuses every operation for a non-administrator", async () => {
  const created = await run((service) =>
    service.create(adminId, { ...genericInput, events: ["task.created"] })
  );
  const { id } = created.endpoint;
  const calls = [
    failure((service) => service.list(employeeId)),
    failure((service) =>
      service.create(employeeId, { ...genericInput, events: ["task.created"] })
    ),
    failure((service) =>
      service.update(employeeId, id, {
        enabled: true,
        events: ["task.created"],
        name: "x",
        url: genericInput.url,
      })
    ),
    failure((service) => service.rotateSecret(employeeId, id)),
    failure((service) => service.remove(employeeId, id)),
    failure((service) => service.listDeliveries(employeeId, id, 10)),
    failure((service) => service.redeliver(employeeId, randomUUID())),
  ];
  const errors = await Promise.all(calls);
  expect(errors.map(({ code }) => code)).toEqual(errors.map(() => "FORBIDDEN"));
});
