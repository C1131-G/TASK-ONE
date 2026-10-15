import { authPool } from "./database";

export const LOGIN_LOCK_THRESHOLD = 5;
export const LOGIN_LOCK_MINUTES = 15;

export interface SignInTarget {
  readonly id: string;
  readonly lockedUntil: Date | null;
  readonly failedLoginCount: number;
}

export const normalizeEmail = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;

export const findSignInTarget = async (
  email: string
): Promise<SignInTarget | null> => {
  const result = await authPool.query<SignInTarget>(
    'SELECT id, "lockedUntil", "failedLoginCount" FROM "user" WHERE "emailNormalized" = $1',
    [email]
  );
  return result.rows[0] ?? null;
};

export const isLocked = (target: SignInTarget | null, now: Date): boolean =>
  Boolean(target?.lockedUntil && target.lockedUntil.getTime() > now.getTime());

// A lock that has run out starts the count again.
export const clearExpiredLock = async (
  target: SignInTarget | null,
  now: Date
): Promise<void> => {
  if (target?.lockedUntil && target.lockedUntil.getTime() <= now.getTime()) {
    await authPool.query(
      'UPDATE "user" SET "failedLoginCount" = 0, "lockedUntil" = NULL WHERE id = $1 AND "lockedUntil" <= now()',
      [target.id]
    );
  }
};

// Counts one failed sign-in in a single statement, so concurrent attempts
// cannot step over the limit. Reports whether this failure locked the account.
export const recordFailedSignIn = async (
  userId: string
): Promise<{ readonly count: number; readonly locked: boolean }> => {
  const result = await authPool.query<{ count: number }>(
    `UPDATE "user"
        SET "failedLoginCount" = "failedLoginCount" + 1,
            "lockedUntil" = CASE
              WHEN "failedLoginCount" + 1 >= $2
              THEN now() + make_interval(mins => $3)
              ELSE "lockedUntil"
            END
      WHERE id = $1
  RETURNING "failedLoginCount" AS count`,
    [userId, LOGIN_LOCK_THRESHOLD, LOGIN_LOCK_MINUTES]
  );
  const count = result.rows[0]?.count ?? 0;
  return { count, locked: count === LOGIN_LOCK_THRESHOLD };
};

export const recordSuccessfulSignIn = async (userId: string): Promise<void> => {
  await authPool.query(
    'UPDATE "user" SET "failedLoginCount" = 0, "lockedUntil" = NULL, "lastActiveAt" = now() WHERE id = $1',
    [userId]
  );
};
