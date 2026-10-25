import { Cause, Effect, Exit, Option } from "effect";
import { createContext, useContext, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceField } from "@/components/workspace/workspace-field";
import { WorkspaceFieldError } from "@/components/workspace/workspace-field-error";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { WorkspaceTextInput } from "@/components/workspace/workspace-text-input";
import { ValidationFailed, type AppFailure } from "@/errors";
import type { SessionService } from "@/services/session";

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** Client-side field checks; the server remains authoritative. */
export const validateCredentials = (
  values: Credentials,
):
  | { readonly ok: true; readonly values: Credentials }
  | { readonly ok: false; readonly errors: Record<string, string> } => {
  const email = values.email.trim();
  const errors: Record<string, string> = {};
  if (email.length < 3) {
    errors.email = "Enter your email";
  }
  if (values.password.length < 8) {
    errors.password = "Password needs at least 8 characters";
  }
  return Object.keys(errors).length === 0
    ? { ok: true, values: { email, password: values.password } }
    : { ok: false, errors };
};

export const SessionContext = createContext<SessionService | null>(null);

/** The session from the nearest provider, or null outside one. */
export const useSession = (): SessionService | null => useContext(SessionContext);

const failureOf = (exit: Exit.Exit<unknown, AppFailure> | undefined): AppFailure | undefined =>
  exit === undefined || Exit.isSuccess(exit)
    ? undefined
    : Option.getOrUndefined(Cause.findErrorOption(exit.cause));

const fieldError = (message: string | undefined, field: string): AppFailure | undefined =>
  message === undefined
    ? undefined
    : new ValidationFailed({ fieldErrors: { [field]: message } });

export interface LoginScreenProps {
  readonly session?: SessionService;
}

/** The sign-in screen; the route gate reacts to the session it mutates. */
export const LoginScreen = ({ session: sessionProp }: LoginScreenProps) => {
  const session = sessionProp ?? useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const signIn = useMutation({
    mutationFn: (input: Credentials) => Effect.runPromiseExit(session!.signIn(input)),
  });

  const submit = (): void => {
    const validated = validateCredentials({ email, password });
    if (!validated.ok) {
      setFieldErrors(validated.errors);
      return;
    }
    setFieldErrors({});
    signIn.mutate(validated.values);
  };

  const serverFailure = failureOf(signIn.data);

  return (
    <WorkspaceScreen title="Sign in">
      <View style={styles.form}>
        <WorkspaceField label="Email">
          <WorkspaceTextInput
            invalid={fieldErrors.email !== undefined}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@metsys.test"
            value={email}
          />
        </WorkspaceField>
        <WorkspaceFieldError failure={fieldError(fieldErrors.email, "email")} field="email" />
        <WorkspaceField label="Password">
          <WorkspaceTextInput
            invalid={fieldErrors.password !== undefined}
            onChangeText={setPassword}
            secureTextEntry
            value={password}
          />
        </WorkspaceField>
        <WorkspaceFieldError
          failure={
            serverFailure?._tag === "ValidationFailed"
              ? serverFailure
              : fieldError(fieldErrors.password, "password")
          }
          field="password"
        />
        {serverFailure === undefined || serverFailure._tag === "ValidationFailed" ? null : (
          <WorkspaceFieldError failure={serverFailure} />
        )}
        <WorkspaceButton disabled={session === null || signIn.isPending} onPress={submit}>
          {signIn.isPending ? "Signing in" : "Sign in"}
        </WorkspaceButton>
      </View>
    </WorkspaceScreen>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 12,
    paddingTop: 12,
  },
});
