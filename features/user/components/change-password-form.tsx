"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css to match the reference UI. */

import { CheckCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { AuthAlert } from "@/features/user/components/auth-alert";
import {
  AuthFieldSkeleton,
  AuthFormSkeleton,
} from "@/features/user/components/auth-skeleton";
import { AuthSubmitButton } from "@/features/user/components/auth-submit-button";
import { PasswordInput } from "@/features/user/components/password-input";
import { PasswordStrength } from "@/features/user/components/password-strength";
import { readFormText } from "@/features/user/read-form-text";
import { changeOwnPasswordAction } from "@/features/user/user-actions";

type ErrorField = "currentPassword" | "confirmPassword";

const ERROR_ID = "change-password-error";

const MatchStatus = ({
  confirmPassword,
  newPassword,
}: {
  readonly confirmPassword: string;
  readonly newPassword: string;
}) => {
  if (!confirmPassword) {
    return null;
  }
  const matches = confirmPassword === newPassword;

  return (
    <p className="auth-match" data-state={matches ? "ok" : "no"}>
      {matches ? (
        <CheckCircle aria-hidden="true" size={13} weight="bold" />
      ) : null}
      {matches ? "Passwords match" : "Passwords don’t match yet"}
    </p>
  );
};

const ChangePasswordForm = () => {
  const router = useRouter();
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<ErrorField>();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fail = (message: string, field: ErrorField) => {
    setError(message);
    setErrorField(field);
    const target =
      field === "confirmPassword" ? confirmPasswordRef : currentPasswordRef;
    target.current?.focus();
    setPending(false);
  };

  const clearError = () => {
    setError("");
    setErrorField(undefined);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    const currentPassword = readFormText(
      new FormData(event.currentTarget),
      "currentPassword"
    );

    if (newPassword !== confirmPassword) {
      fail("The new passwords do not match.", "confirmPassword");
      return;
    }

    setPending(true);
    try {
      const result = await changeOwnPasswordAction({
        currentPassword,
        newPassword,
      });
      if (result.ok) {
        // The password page routes a finished account to its own home
        // (workspace or client portal) on the server.
        router.replace("/change-password");
        router.refresh();
        return;
      }
      fail(result.error.message, "currentPassword");
    } catch {
      fail("Your password could not be changed. Try again.", "currentPassword");
    }
  };

  const describedBy = (field: ErrorField) =>
    errorField === field ? ERROR_ID : undefined;

  return (
    <form className="auth-form" onSubmit={submit}>
      <AuthAlert id={ERROR_ID} message={error} />
      <div className="auth-field">
        <label className="auth-label" htmlFor="current-password">
          Temporary password
        </label>
        <PasswordInput
          aria-describedby={describedBy("currentPassword")}
          aria-invalid={errorField === "currentPassword" ? true : undefined}
          autoComplete="current-password"
          id="current-password"
          maxLength={128}
          name="currentPassword"
          onChange={clearError}
          placeholder="From your administrator"
          ref={currentPasswordRef}
          required
          visibilityLabel="temporary password"
        />
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="new-password">
          New password
        </label>
        <PasswordInput
          aria-describedby="new-password-hint"
          autoComplete="new-password"
          id="new-password"
          maxLength={128}
          minLength={12}
          name="newPassword"
          onChange={(event) => {
            setNewPassword(event.currentTarget.value);
            clearError();
          }}
          placeholder="At least 12 characters"
          required
          visibilityLabel="new password"
        />
        <PasswordStrength password={newPassword} />
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="confirm-password">
          Confirm new password
        </label>
        <PasswordInput
          aria-describedby={describedBy("confirmPassword")}
          aria-invalid={errorField === "confirmPassword" ? true : undefined}
          autoComplete="new-password"
          id="confirm-password"
          maxLength={128}
          minLength={12}
          name="confirmPassword"
          onChange={(event) => {
            setConfirmPassword(event.currentTarget.value);
            clearError();
          }}
          placeholder="Repeat your new password"
          ref={confirmPasswordRef}
          required
          visibilityLabel="confirmation password"
        />
        <MatchStatus
          confirmPassword={confirmPassword}
          newPassword={newPassword}
        />
      </div>
      <AuthSubmitButton
        idleLabel="Set password and continue"
        pending={pending}
        pendingLabel="Updating password…"
      />
    </form>
  );
};

const ChangePasswordFormSkeleton = () => (
  <AuthFormSkeleton>
    <AuthFieldSkeleton />
    <AuthFieldSkeleton withHint />
    <AuthFieldSkeleton />
  </AuthFormSkeleton>
);

export { ChangePasswordForm, ChangePasswordFormSkeleton };
