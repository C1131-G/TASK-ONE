import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Effect } from "effect";

import { ChangePasswordScreen } from "@/features/auth/change-password-screen";
import { LoginScreen, validateCredentials } from "@/features/auth/login-screen";
import { ValidationFailed, type AppFailure } from "@/errors";
import type { SessionState } from "@/services/session";
import type { SessionService } from "@/services/session";
import { renderWithTheme } from "../components/support/theme";

const authenticatedState: SessionState = {
  kind: "authenticated",
  me: {
    clientCompanyId: null,
    id: "user-1",
    mustChangePassword: false,
    name: "Ada",
    role: "employee",
    timeZone: "Asia/Kolkata",
  },
  token: "t",
};

const stubSession = (overrides: {
  readonly signIn?: (input: { email: string; password: string }) => Effect.Effect<SessionState, AppFailure>;
  readonly changeOwnPassword?: (input: { currentPassword: string; newPassword: string }) => Effect.Effect<void, AppFailure>;
}): SessionService =>
  ({
    changeOwnPassword: overrides.changeOwnPassword ?? (() => Effect.void),
    changes: undefined,
    current: Effect.succeed(authenticatedState),
    invalidate: Effect.void,
    restore: Effect.succeed(authenticatedState),
    signIn: overrides.signIn ?? (() => Effect.succeed(authenticatedState)),
    signOut: Effect.void,
    watchClientIdle: () => Effect.never,
  }) as unknown as SessionService;

it("validates credentials before calling the session", () => {
  const bad = validateCredentials({ email: "", password: "short" });

  expect(bad.ok).toBe(false);
  expect(bad.ok ? null : bad.errors.email).toBe("Enter your email");
  expect(bad.ok ? null : bad.errors.password).toContain("8 characters");

  const good = validateCredentials({ email: " ada@taskora.test ", password: "longenough" });

  expect(good.ok).toBe(true);
  expect(good.ok ? good.values.email : null).toBe("ada@taskora.test");
});

it("signs in through the session and shows the server field error", async () => {
  const attempts: string[] = [];
  const user = userEvent.setup();
  await renderWithTheme(
    <LoginScreen
      session={stubSession({
        signIn: (input) => {
          attempts.push(input.email);
          return Effect.fail(
            new ValidationFailed({ fieldErrors: { password: "Wrong credentials" } }),
          );
        },
      })}
    />,
  );

  await user.type(screen.getByLabelText("Email"), "ada@taskora.test");
  await user.type(screen.getByLabelText("Password"), "longenough");
  await user.press(screen.getByRole("button", { name: "Sign in" }));

  await waitFor(() => expect(screen.getByText("Wrong credentials")).toBeTruthy());
  expect(attempts).toEqual(["ada@taskora.test"]);
});

it("blocks submission when the local fields fail", async () => {
  let calls = 0;
  const user = userEvent.setup();
  await renderWithTheme(
    <LoginScreen
      session={stubSession({
        signIn: () => {
          calls += 1;
          return Effect.succeed(authenticatedState);
        },
      })}
    />,
  );

  await user.type(screen.getByLabelText("Password"), "short");
  await user.press(screen.getByRole("button", { name: "Sign in" }));

  expect(calls).toBe(0);
  expect(screen.getByText("Enter your email")).toBeTruthy();
});

it("changes the password and calls onDone", async () => {
  const changed: string[] = [];
  const user = userEvent.setup();
  await renderWithTheme(
    <ChangePasswordScreen
      onDone={() => changed.push("done")}
      session={stubSession({
        changeOwnPassword: (input) => {
          changed.push(input.currentPassword);
          return input.currentPassword === "old-pass"
            ? Effect.void
            : Effect.fail(
                new ValidationFailed({ fieldErrors: { currentPassword: "Wrong password" } }),
              );
        },
      })}
    />,
  );

  await user.type(screen.getByLabelText("Current password"), "old-pass");
  await user.type(screen.getByLabelText("New password"), "brand-new-pass");
  await user.type(screen.getByLabelText("Repeat new password"), "brand-new-pass");
  await user.press(screen.getByRole("button", { name: "Save new password" }));

  await waitFor(() => expect(changed).toEqual(["old-pass", "done"]));
});

it("shows the mismatch and server field errors on the change screen", async () => {
  const user = userEvent.setup();
  await renderWithTheme(
    <ChangePasswordScreen
      onDone={() => undefined}
      session={stubSession({
        changeOwnPassword: () =>
          Effect.fail(
            new ValidationFailed({ fieldErrors: { currentPassword: "Wrong password" } }),
          ),
      })}
    />,
  );

  await user.type(screen.getByLabelText("Current password"), "old-pass");
  await user.type(screen.getByLabelText("New password"), "brand-new-pass");
  await user.type(screen.getByLabelText("Repeat new password"), "different-pass");
  await user.press(screen.getByRole("button", { name: "Save new password" }));

  expect(await screen.findByText("The passwords do not match")).toBeTruthy();
});
