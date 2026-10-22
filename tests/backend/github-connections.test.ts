import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import {
  GithubConnections,
  GithubConnectionsLive,
} from "../../src/server/github/github-connections";
import { decryptSecret } from "../../src/server/webhooks/webhook-secret";
import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const run = <Value, Failure>(
  program: (
    service: GithubConnections["Service"]
  ) => Effect.Effect<Value, Failure>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* use() {
        return yield* program(yield* GithubConnections);
      }),
      GithubConnectionsLive
    )
  );

const failure = <Value>(
  program: (
    service: GithubConnections["Service"]
  ) => Effect.Effect<Value, { readonly code: string }>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* use() {
        const service = yield* GithubConnections;
        return yield* Effect.flip(program(service));
      }),
      GithubConnectionsLive
    )
  );

beforeAll(setupHarness);
afterAll(async () => {
  await authPool.query(
    'DELETE FROM github_connection WHERE "createdById" = $1',
    [personaId("admin")]
  );
  await authPool.query(
    "DELETE FROM activity WHERE \"actorId\" = $1 AND action LIKE 'github.%'",
    [personaId("admin")]
  );
  await teardownHarness();
});

const repo = () => `acme/repo-${randomUUID().slice(0, 8)}`;

it("shows the secret once, stores it encrypted and never lists it again", async () => {
  const admin = personaId("admin");
  const name = repo();
  const created = await run((service) =>
    service.create(admin, {
      autoCompleteOnMerge: false,
      projectId: ids.projectId,
      repoFullName: name.toUpperCase(),
    })
  );
  expect(created.secret.startsWith("whsec_")).toBe(true);
  expect(created.connection).toMatchObject({
    autoCompleteOnMerge: false,
    enabled: true,
    repoFullName: name,
    secretHint: created.secret.slice(-4),
  });
  const stored = await authPool.query<{ secretCiphertext: string }>(
    'SELECT "secretCiphertext" FROM github_connection WHERE id = $1',
    [created.connection.id]
  );
  const ciphertext = stored.rows[0]?.secretCiphertext ?? "";
  expect(ciphertext).not.toContain(created.secret);
  expect(
    decryptSecret(ciphertext, process.env["BETTER_AUTH_SECRET"] ?? "")
  ).toBe(created.secret);
  const listed = await run((service) => service.list(admin));
  expect(JSON.stringify(listed)).not.toContain(created.secret);
  expect(listed.map(({ id }) => id)).toContain(created.connection.id);
});

it("allows one connection per repository, whatever its case", async () => {
  const admin = personaId("admin");
  const name = repo();
  const input = {
    autoCompleteOnMerge: false,
    projectId: ids.projectId,
    repoFullName: name,
  };
  await run((service) => service.create(admin, input));
  const refused = await failure((service) =>
    service.create(admin, { ...input, repoFullName: name.toUpperCase() })
  );
  expect(refused.code).toBe("CONFLICT");
});

it("rejects malformed repository names and unknown or archived projects", async () => {
  const admin = personaId("admin");
  for (const repoFullName of [
    "",
    "no-slash",
    "a/b/c",
    "../etc/passwd",
    "owner/na me",
    "owner/<script>",
  ]) {
    // oxlint-disable-next-line no-await-in-loop
    const refused = await failure((service) =>
      service.create(admin, {
        autoCompleteOnMerge: false,
        projectId: ids.projectId,
        repoFullName,
      })
    );
    expect(refused.code).toBe("VALIDATION_FAILED");
  }
  const unknownProject = await failure((service) =>
    service.create(admin, {
      autoCompleteOnMerge: false,
      projectId: randomUUID(),
      repoFullName: repo(),
    })
  );
  expect(unknownProject.code).toBe("VALIDATION_FAILED");
  const archived = await failure((service) =>
    service.create(admin, {
      autoCompleteOnMerge: false,
      projectId: ids.archivedProjectId,
      repoFullName: repo(),
    })
  );
  expect(archived.code).toBe("VALIDATION_FAILED");
});

it("rotates the secret, disables and re-enables, and toggles auto-complete", async () => {
  const admin = personaId("admin");
  const created = await run((service) =>
    service.create(admin, {
      autoCompleteOnMerge: false,
      projectId: ids.projectId,
      repoFullName: repo(),
    })
  );
  const rotated = await run((service) =>
    service.rotateSecret(admin, created.connection.id)
  );
  expect(rotated.secret).not.toBe(created.secret);
  const updated = await run((service) =>
    service.update(admin, created.connection.id, {
      autoCompleteOnMerge: true,
      enabled: false,
    })
  );
  expect(updated).toMatchObject({
    autoCompleteOnMerge: true,
    enabled: false,
    secretHint: rotated.secret.slice(-4),
  });
  const activity = await authPool.query<{ action: string }>(
    "SELECT action FROM activity WHERE details->>'connectionId' = $1 ORDER BY \"createdAt\"",
    [created.connection.id]
  );
  expect(activity.rows.map(({ action }) => action)).toEqual([
    "github.connected",
    "github.secret_rotated",
    "github.updated",
  ]);
  await authPool.query(
    "DELETE FROM activity WHERE details->>'connectionId' = $1",
    [created.connection.id]
  );
});

it("is administrator-only and reports a missing connection", async () => {
  for (const persona of ["owner", "client", "outsider"] as const) {
    // oxlint-disable-next-line no-await-in-loop
    const refused = await failure((service) =>
      service.list(personaId(persona))
    );
    expect(["FORBIDDEN", "UNAUTHENTICATED"]).toContain(refused.code);
  }
  const missing = await failure((service) =>
    service.rotateSecret(personaId("admin"), randomUUID())
  );
  expect(missing.code).toBe("NOT_FOUND");
});
