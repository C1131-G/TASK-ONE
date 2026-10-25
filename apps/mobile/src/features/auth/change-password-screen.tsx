import { Cause, Effect, Exit, Option } from "effect";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceField } from "@/components/workspace/workspace-field";
import { WorkspaceFieldError } from "@/components/workspace/workspace-field-error";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { WorkspaceTextInput } from "@/components/workspace/workspace-text-input";
import { type AppFailure, ValidationFailed } from "@/errors";
import type { SessionService } from "@/services/session";

export interface ChangePasswordScreenProps {
  readonly onDone: () => void;
  readonly session?: SessionService;
}

/** The forced (or voluntary) password change; the session stays signed in. */
export const ChangePasswordScreen = ({ onDone, session: sessionProp }: ChangePasswordScreenProps) => {
  const session = sessionProp ?? undefined;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverFailure, setServerFailure] = useState<AppFailure | undefined>(undefined);
  const [pending, setPending] = useState(false);

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
    setServerFailure(undefined);
    if (Object.keys(errors).length > 0 || session === undefined) {
      return;
    }
    setPending(true);
    void Effect.runPromiseExit(
      session.changeOwnPassword({ currentPassword, newPassword }),
    ).then((exit) => {
      setPending(false);
      if (Exit.isSuccess(exit)) {
        onDone();
        return;
      }
      setServerFailure(
        Exit.isSuccess(exit)
          ? undefined
          : Option.getOrUndefined(Cause.findErrorOption(exit.cause)),
      );
    });
  };

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
              : fieldMessage(fieldErrors.currentPassword, "currentPassword")
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
          failure={fieldMessage(fieldErrors.newPassword, "newPassword")}
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
          failure={fieldMessage(fieldErrors.confirm, "confirm")}
          field="confirm"
        />
        <WorkspaceButton disabled={pending} onPress={submit}>
          {pending ? "Saving" : "Save new password"}
        </WorkspaceButton>
      </View>
    </WorkspaceScreen>
  );
};

const fieldMessage = (message: string | undefined, field: string): AppFailure | undefined =>
  message === undefined
    ? undefined
    : new ValidationFailed({ fieldErrors: { [field]: message } });

const styles = StyleSheet.create({
  form: {
    gap: 12,
    paddingTop: 12,
  },
});
