import { Effect, Layer } from "effect";

import { changePasswordRoute } from "../../mobile-api/routes-account";
import type { AppError } from "../core/action-result";
import {
  PasswordManagement,
  PasswordManagementLive,
} from "../people/password-management";
import { readRouteInput } from "./route-input";

// The caller is signed in before the body is read (`readRouteInput` gates every
// /me path), and the account may still be waiting to set its first password.
export const changePassword = (
  request: Request
): Effect.Effect<{ readonly changed: boolean }, AppError> =>
  Effect.gen(function* change() {
    const { body } = yield* readRouteInput(changePasswordRoute, request);
    const passwords = yield* PasswordManagement;
    yield* passwords.changeOwnPassword(
      request.headers,
      body.currentPassword,
      body.newPassword
    );
    return { changed: true };
  }).pipe(Effect.provide(Layer.mergeAll(PasswordManagementLive)));
