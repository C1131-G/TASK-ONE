import { afterAll, beforeAll } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { auth } from "../../../src/server/auth/auth";
import { ClientCompanyManagement } from "../../../src/server/clients/client-company-contracts";
import { ClientCompanyManagementLive } from "../../../src/server/clients/client-company-management";
import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./action-harness";

export const portal = await import("../../../features/portal/portal-actions");
export const portalUploads =
  await import("../../../features/portal/portal-upload-actions");
export const portalNotifications =
  await import("../../../features/portal/portal-notification-actions");
export const portalQueries =
  await import("../../../features/portal/portal-queries");
export const clientQueries =
  await import("../../../features/clients/clients-queries");
export const clients =
  await import("../../../features/clients/clients-actions");
export const people = await import("../../../features/people/people-actions");
export const previewRoute =
  await import("../../../app/(portal)/portal/preview/route");

let addressCounter = Number.parseInt(randomUUID().slice(0, 4), 16);
export const nextAddress = (): string => {
  addressCounter += 1;
  return `203.0.${Math.floor(addressCounter / 250) % 250}.${(addressCounter % 250) + 1}`;
};

export interface ClientLogin {
  readonly email: string;
  readonly id: string;
  readonly password: string;
}

export const createClient = async (): Promise<ClientLogin> => {
  const created = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* createClientUser() {
        const management = yield* ClientCompanyManagement;
        return yield* management.createClientUser(personaId("admin"), {
          companyId: ids.clientCompanyId,
          email: `lock-${randomUUID().slice(0, 8)}@action-harness.example`,
          name: "Lockout Client",
        });
      }),
      ClientCompanyManagementLive
    )
  );
  await authPool.query(
    'UPDATE "user" SET "mustChangePassword" = false WHERE id = $1',
    [created.id]
  );
  return {
    email: created.email,
    id: created.id,
    password: created.temporaryPassword,
  };
};

export const signIn = (
  email: string,
  password: string,
  extra: HeadersInit = {}
) =>
  auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      body: JSON.stringify({ email, password }),
      headers: {
        "content-type": "application/json",
        "user-agent": "Vitest Browser/1.0",
        "x-forwarded-for": nextAddress(),
        ...extra,
      },
      method: "POST",
    })
  );

export const cookieOf = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

export const loginState = async (userId: string) => {
  const result = await authPool.query<{
    failedLoginCount: number;
    lastActiveAt: Date | null;
    lockedUntil: Date | null;
  }>(
    'SELECT "failedLoginCount", "lastActiveAt", "lockedUntil" FROM "user" WHERE id = $1',
    [userId]
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error("user missing");
  }
  return row;
};

export const failedCount = async (userId: string): Promise<number> => {
  const row = await loginState(userId);
  return row.failedLoginCount;
};

export const lastActiveMs = async (userId: string): Promise<number> => {
  const row = await loginState(userId);
  return row.lastActiveAt?.getTime() ?? 0;
};

export const auditTypes = async (subjectId: string): Promise<string[]> => {
  const result = await authPool.query<{ type: string }>(
    'SELECT type FROM audit_event WHERE "subjectUserId" = $1 ORDER BY "createdAt", id',
    [subjectId]
  );
  return result.rows.map(({ type }) => type);
};

export const installHooks = () => {
  beforeAll(async () => {
    await setupHarness();
    await authPool.query(
      'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
      [randomUUID(), ids.clientCompanyId, ids.projectId]
    );
  });
  afterAll(teardownHarness);
};
