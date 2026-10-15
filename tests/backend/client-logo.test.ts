import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Exit, Layer } from "effect";

import {
  authPool,
  callAs,
  callAsWithCookie,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { Persona } from "./support/action-harness";

const logoActions = await import("../../features/clients/client-logo-actions");
const clientQueries = await import("../../features/clients/clients-queries");
const { getPortalCompany } =
  await import("../../features/portal/portal-company");
const { PORTAL_PREVIEW_COOKIE } = await import("../../src/server/auth/session");
const { ClientLogos, MAX_CLIENT_LOGO_BYTES } =
  await import("../../src/server/clients/client-logo-contracts");
const { ClientLogosLive, DELETE_CLIENT_LOGO_JOB } =
  await import("../../src/server/clients/client-logo");
const { Storage } = await import("../../src/server/storage/storage");

beforeAll(setupHarness);
afterAll(teardownHarness);

const SIGNED_PREVIEW = "https://private.example/logo-preview";
const storageCalls = { deleted: [] as string[], verifyFails: false };

const storageLayer = Layer.succeed(
  Storage,
  Storage.of({
    copyObject: () => Effect.void,
    deleteObject: (key) => {
      storageCalls.deleted.push(key);
      return Effect.void;
    },
    signDownload: () => Effect.succeed("https://private.example/download"),
    signPreview: (key) => Effect.succeed(`${SIGNED_PREVIEW}?key=${key}`),
    signUpload: () => Effect.succeed("https://private.example/upload"),
    verifyObject: () =>
      storageCalls.verifyFails
        ? Effect.die("the object is missing")
        : Effect.void,
  })
);

type LogoService = typeof ClientLogos.Service;

const withLogos = <Value, Failure>(
  program: (logos: LogoService) => Effect.Effect<Value, Failure>
) =>
  Effect.runPromiseExit(
    Effect.provide(
      Effect.flatMap(Effect.service(ClientLogos), program),
      Layer.provide(ClientLogosLive, storageLayer)
    )
  );

const succeed = async <Value, Failure>(
  program: (logos: LogoService) => Effect.Effect<Value, Failure>
): Promise<Value> => {
  const exit = await withLogos(program);
  if (Exit.isFailure(exit)) {
    throw new Error(`Logo operation failed: ${String(exit.cause)}`);
  }
  return exit.value;
};

const failureCode = async <Value, Failure>(
  program: (logos: LogoService) => Effect.Effect<Value, Failure>
): Promise<string> => {
  const exit = await withLogos(program);
  if (Exit.isSuccess(exit)) {
    return "succeeded";
  }
  const [error] = exit.cause.reasons.flatMap((reason) =>
    reason._tag === "Fail" ? [reason.error] : []
  );
  return (error as { readonly code?: string } | undefined)?.code ?? "DEFECT";
};

const companyRow = async (companyId: string) => {
  const rows = await authPool.query<{
    logoAssetId: string | null;
    version: number;
  }>('SELECT "logoAssetId", version FROM client_company WHERE id = $1', [
    companyId,
  ]);
  const [row] = rows.rows;
  if (!row) {
    throw new Error("The client company row is missing.");
  }
  return row;
};

const intentRow = async (intentId: string) => {
  const rows = await authPool.query<{ objectKey: string; state: string }>(
    'SELECT "objectKey", state FROM upload_intent WHERE id = $1',
    [intentId]
  );
  return rows.rows[0];
};

// Requests and finalizes a logo for the harness client company as the admin.
const uploadLogo = async (contentType = "image/png") => {
  const { version } = await companyRow(ids.clientCompanyId);
  const ticket = await succeed((logos) =>
    logos.requestLogoUpload(personaId("admin"), {
      companyId: ids.clientCompanyId,
      contentType,
      sizeBytes: 4096,
    })
  );
  const receipt = await succeed((logos) =>
    logos.finalizeLogoUpload(personaId("admin"), {
      companyId: ids.clientCompanyId,
      expectedVersion: version,
      uploadIntentId: ticket.uploadIntentId,
    })
  );
  return { receipt, ticket, version };
};

const readPortalCompany = async () => ({
  data: await getPortalCompany(),
  ok: true as const,
});

const portalCompanyAs = async (persona: Persona, cookie?: string) => {
  const read = readPortalCompany;
  const result = cookie
    ? await callAsWithCookie(persona, cookie, read, {})
    : await callAs(persona, read, {});
  return result.data;
};

it("lets an admin upload a client logo and returns a signed URL for it", async () => {
  const { receipt, ticket, version } = await uploadLogo();
  expect(ticket.requiredHeaders).toEqual({
    "content-type": "image/png",
    "if-none-match": "*",
  });
  expect(receipt).toEqual({
    companyId: ids.clientCompanyId,
    version: version + 1,
  });
  const company = await companyRow(ids.clientCompanyId);
  expect(company.logoAssetId).toBe(ticket.uploadIntentId);
  const intent = await intentRow(ticket.uploadIntentId);
  expect(intent?.state).toBe("finalized");
  expect(
    intent?.objectKey.startsWith(`company/client-logos/${ids.clientCompanyId}/`)
  ).toBe(true);

  const url = await succeed((logos) =>
    logos.signedLogo(personaId("admin"), ids.clientCompanyId)
  );
  expect(url).toBe(`${SIGNED_PREVIEW}?key=${intent?.objectKey}`);

  // The admin detail page carries a signed URL from the real signer.
  const detail = await callAs("admin", clientQueries.getClientCompany, {
    companyId: ids.clientCompanyId,
  });
  if (!detail.ok) {
    throw new Error(detail.error.message);
  }
  expect(typeof detail.data.logoUrl).toBe("string");
  expect(detail.data.logoUrl).toContain(ids.clientCompanyId);

  const activity = await authPool.query(
    `SELECT 1 FROM activity WHERE "actorId" = $1 AND action = 'client_company.logo_set' AND details->>'companyId' = $2`,
    [personaId("admin"), ids.clientCompanyId]
  );
  expect(activity.rowCount).toBeGreaterThan(0);

  // An upload ticket can be finalized once; a stale version is refused.
  expect(
    await failureCode((logos) =>
      logos.finalizeLogoUpload(personaId("admin"), {
        companyId: ids.clientCompanyId,
        expectedVersion: receipt.version,
        uploadIntentId: ticket.uploadIntentId,
      })
    )
  ).toBe("CONFLICT");
  const second = await succeed((logos) =>
    logos.requestLogoUpload(personaId("admin"), {
      companyId: ids.clientCompanyId,
      contentType: "image/webp",
      sizeBytes: 2048,
    })
  );
  expect(
    await failureCode((logos) =>
      logos.finalizeLogoUpload(personaId("admin"), {
        companyId: ids.clientCompanyId,
        expectedVersion: version,
        uploadIntentId: second.uploadIntentId,
      })
    )
  ).toBe("CONFLICT");
});

it("replaces a logo and queues the previous object for deletion", async () => {
  const first = await uploadLogo();
  const firstIntent = await intentRow(first.ticket.uploadIntentId);
  const firstKey = firstIntent?.objectKey;
  const replaced = await uploadLogo("image/jpeg");
  const company = await companyRow(ids.clientCompanyId);
  expect(company.logoAssetId).toBe(replaced.ticket.uploadIntentId);
  const retired = await intentRow(first.ticket.uploadIntentId);
  expect(retired?.state).toBe("removed");
  const jobs = await authPool.query<{ payload: { objectKey: string } }>(
    "SELECT payload FROM job WHERE kind = $1 AND payload->>'objectKey' = $2",
    [DELETE_CLIENT_LOGO_JOB, firstKey]
  );
  expect(jobs.rowCount).toBe(1);
});

it("refuses logo changes from anyone but an admin", async () => {
  for (const persona of ["owner", "client", "otherClient"] as const) {
    // Sequential: the calls share the mocked request headers.
    // eslint-disable-next-line no-await-in-loop
    const request = await callAs(
      persona,
      logoActions.requestClientLogoUploadAction,
      {
        companyId: ids.clientCompanyId,
        contentType: "image/png",
        idempotencyKey: nextKey(),
        sizeBytes: 1024,
      }
    );
    expect(request).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
    // eslint-disable-next-line no-await-in-loop
    const remove = await callAs(persona, logoActions.removeClientLogoAction, {
      companyId: ids.clientCompanyId,
      expectedVersion: 1,
      idempotencyKey: nextKey(),
    });
    expect(remove).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  }
  const finalize = await callAs(
    "owner",
    logoActions.finalizeClientLogoUploadAction,
    {
      companyId: ids.clientCompanyId,
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      uploadIntentId: randomUUID(),
    }
  );
  expect(finalize).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  // The service checks the role itself, whoever calls it.
  expect(
    await failureCode((logos) =>
      logos.requestLogoUpload(personaId("owner"), {
        companyId: ids.clientCompanyId,
        contentType: "image/png",
        sizeBytes: 1024,
      })
    )
  ).toBe("FORBIDDEN");
  expect(
    await failureCode((logos) =>
      logos.removeLogo(personaId("client"), {
        companyId: ids.clientCompanyId,
        expectedVersion: 1,
      })
    )
  ).toBe("FORBIDDEN");
});

it("rejects logos with the wrong content type or size", async () => {
  const request = (contentType: string, sizeBytes: number) =>
    callAs("admin", logoActions.requestClientLogoUploadAction, {
      companyId: ids.clientCompanyId,
      contentType,
      idempotencyKey: nextKey(),
      sizeBytes,
    });
  for (const [contentType, sizeBytes] of [
    ["image/gif", 1024],
    ["image/svg+xml", 1024],
    ["application/pdf", 1024],
    ["image/png", MAX_CLIENT_LOGO_BYTES + 1],
    ["image/png", 0],
    ["image/png", 1.5],
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    const result = await request(contentType, sizeBytes);
    expect(result, `${contentType} ${sizeBytes}`).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
  }
  // The largest allowed logo gets a ticket, and a replay returns the same one.
  const idempotencyKey = nextKey();
  const input = {
    companyId: ids.clientCompanyId,
    contentType: "image/png",
    idempotencyKey,
    sizeBytes: MAX_CLIENT_LOGO_BYTES,
  };
  const accepted = await callAs(
    "admin",
    logoActions.requestClientLogoUploadAction,
    input
  );
  const replayed = await callAs(
    "admin",
    logoActions.requestClientLogoUploadAction,
    input
  );
  if (!(accepted.ok && replayed.ok)) {
    throw new Error("The largest allowed logo was refused.");
  }
  expect(replayed.data).toEqual(accepted.data);

  // An object that fails verification never becomes the logo.
  const before = await companyRow(ids.clientCompanyId);
  const ticket = await succeed((logos) =>
    logos.requestLogoUpload(personaId("admin"), {
      companyId: ids.clientCompanyId,
      contentType: "image/png",
      sizeBytes: 1024,
    })
  );
  storageCalls.verifyFails = true;
  try {
    const exit = await withLogos((logos) =>
      logos.finalizeLogoUpload(personaId("admin"), {
        companyId: ids.clientCompanyId,
        expectedVersion: before.version,
        uploadIntentId: ticket.uploadIntentId,
      })
    );
    expect(Exit.isFailure(exit)).toBe(true);
  } finally {
    storageCalls.verifyFails = false;
  }
  expect(await companyRow(ids.clientCompanyId)).toEqual(before);
  // A ticket for one company cannot become another company's logo.
  expect(
    await failureCode((logos) =>
      logos.finalizeLogoUpload(personaId("admin"), {
        companyId: ids.otherClientCompanyId,
        expectedVersion: 1,
        uploadIntentId: ticket.uploadIntentId,
      })
    )
  ).toBe("CONFLICT");
});

it("shows a client its own company's logo and never another company's", async () => {
  await uploadLogo();
  const own = await succeed((logos) =>
    logos.signedLogo(personaId("client"), ids.clientCompanyId)
  );
  expect(own).toContain(SIGNED_PREVIEW);
  expect(
    await failureCode((logos) =>
      logos.signedLogo(personaId("otherClient"), ids.clientCompanyId)
    )
  ).toBe("FORBIDDEN");
  expect(
    await failureCode((logos) =>
      logos.signedLogo(personaId("client"), ids.otherClientCompanyId)
    )
  ).toBe("FORBIDDEN");
  expect(
    await failureCode((logos) =>
      logos.signedLogo(personaId("owner"), ids.clientCompanyId)
    )
  ).toBe("FORBIDDEN");

  // The portal header data carries the viewer's own company logo only.
  const clientView = await portalCompanyAs("client");
  expect(typeof clientView?.logoUrl).toBe("string");
  expect(clientView?.logoUrl).toContain(ids.clientCompanyId);
  const otherView = await portalCompanyAs("otherClient");
  expect(otherView?.companyName).toContain(ids.otherClientCompanyId);
  expect(otherView?.logoUrl).toBeNull();
  // An admin previewing the client sees that client's company logo.
  const preview = await portalCompanyAs(
    "admin",
    `${PORTAL_PREVIEW_COOKIE}=${encodeURIComponent(personaId("client"))}`
  );
  expect(preview?.preview).not.toBeNull();
  expect(preview?.logoUrl).toContain(ids.clientCompanyId);
});

it("lets an admin remove the logo", async () => {
  await uploadLogo();
  const before = await companyRow(ids.clientCompanyId);
  const logoIntent = before.logoAssetId
    ? await intentRow(before.logoAssetId)
    : undefined;
  const logoKey = logoIntent?.objectKey;
  const removed = await callAs("admin", logoActions.removeClientLogoAction, {
    companyId: ids.clientCompanyId,
    expectedVersion: before.version,
    idempotencyKey: nextKey(),
  });
  expect(removed).toMatchObject({
    data: { companyId: ids.clientCompanyId, version: before.version + 1 },
    ok: true,
  });
  const after = await companyRow(ids.clientCompanyId);
  expect(after.logoAssetId).toBeNull();
  const jobs = await authPool.query(
    "SELECT 1 FROM job WHERE kind = $1 AND payload->>'objectKey' = $2",
    [DELETE_CLIENT_LOGO_JOB, logoKey]
  );
  expect(jobs.rowCount).toBe(1);
  expect(
    await succeed((logos) =>
      logos.signedLogo(personaId("client"), ids.clientCompanyId)
    )
  ).toBeNull();
  const portalView = await portalCompanyAs("client");
  expect(portalView?.logoUrl).toBeNull();
  const again = await callAs("admin", logoActions.removeClientLogoAction, {
    companyId: ids.clientCompanyId,
    expectedVersion: before.version + 1,
    idempotencyKey: nextKey(),
  });
  expect(again).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
});
