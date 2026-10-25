import { Cause, Effect, Exit, Option } from "effect";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceField } from "@/components/workspace/workspace-field";
import { WorkspaceFieldError } from "@/components/workspace/workspace-field-error";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { WorkspaceTextInput } from "@/components/workspace/workspace-text-input";
import { ValidationFailed, type AppFailure } from "@/errors";
import type { SessionService } from "@/services/session";

const failureOf = (exit: Exit.Exit<unknown, AppFailure> | undefined): AppFailure | undefined =>
  exit === undefined || Exit.isSuccess(exit)
    ? undefined
    : Option.getOrUndefined(Cause.findErrorOption(exit.cause));

const fieldError = (message: string | undefined, field: string): AppFailure | undefined =>
  message === undefined
    ? undefined
    : new ValidationFailed({ fieldErrors: { [field]: message } });

export interface ChangePasswordScreenProps {
  readonly onDone: () => void;
  readonly session?: SessionService;
}

/** The forced (or voluntary) password change; the session stays signed in. */
export const ChangePasswordScreen = ({ onDone, session: sessionProp }: ChangePasswordScreenProps) => {
  const session = sessionProp ?? null;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const change = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      Effect.runPromiseExit(session!.changeOwnPassword(input)),
  });

  const submit = (): void => {
    const errors: Record<string, string> = {};
    if (currentPassword.length === 0) {
      errors.currentPassword = "Enter your current password";
    }
    if (newPassword.length < 8) {
      errors.newPassword = "New password needs at least 8 characters";
    }
    if (confirm !== newPassword) {
      errors.confirm = "The passwords do not match";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || session === null) {
      return;
    }
    change.mutate({ currentPassword, newPassword });
  };

  const serverFailure = failureOf(change.data);

  const succeeded = change.data !== undefined && Exit.isSuccess(change.data);
  useEffect(() => {
    if (succeeded) {
      onDone();
    }
  }, [succeeded, onDone]);

  return (
    <WorkspaceScreen title="Change password">
      <View style={styles.form}>
        <WorkspaceField label="Current password">
          <WorkspaceTextInput
            invalid={fieldErrors.currentPassword !== undefined}
            onChangeText={setCurrentPassword}
            secureTextEntry
            value={currentPassword}
          />
        </WorkspaceField>
        <WorkspaceFieldError
          failure={
            serverFailure?._tag === "ValidationFailed"
              ? serverFailure
              : fieldError(fieldErrors.currentPassword, "currentPassword")
          }
          field="currentPassword"
        />
        <WorkspaceField label="New password">
          <WorkspaceTextInput
            invalid={fieldErrors.newPassword !== undefined}
            onChangeText={setNewPassword}
            secureTextEntry
            value={newPassword}
          />
        </WorkspaceField>
        <WorkspaceFieldError
          failure={fieldError(fieldErrors.newPassword, "newPassword")}
          field="newPassword"
        />
        <WorkspaceField label="Repeat new password">
          <WorkspaceTextInput
            invalid={fieldErrors.confirm !== undefined}
            onChangeText={setConfirm}
            secureTextEntry
            value={confirm}
          />
        </WorkspaceField>
        <WorkspaceFieldError
          failure={fieldError(fieldErrors.confirm, "confirm")}
          field="confirm"
        />
        <WorkspaceButton disabled={session === null || change.isPending} onPress={submit}>
          {change.isPending ? "Saving" : "Save new password"}
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
