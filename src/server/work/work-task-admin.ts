import { AppError } from "../core/action-result";
import type { Transaction } from "./work-internal";

export const requireTaskAdmin = async (
  transaction: Transaction,
  actorId: string
): Promise<void> => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("name", "role", "mustChangePassword", "deactivatedAt")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.role !== "admin" || actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "An admin account with a changed password is required.",
    });
  }
};
