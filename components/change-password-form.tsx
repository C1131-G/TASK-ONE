"use client";

/* eslint-disable shadcn/no-restyle */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { changeOwnPasswordAction } from "@/app/actions/password";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

const ChangePasswordForm = () => {
  const router = useRouter();
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<
    "currentPassword" | "confirmPassword" | null
  >(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setErrorField(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      setErrorField("confirmPassword");
      confirmPasswordRef.current?.focus();
      setPending(false);
      return;
    }

    try {
      const result = await changeOwnPasswordAction({
        currentPassword,
        newPassword,
      });
      if (result.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError(result.error.message);
        setErrorField("currentPassword");
        currentPasswordRef.current?.focus();
      }
    } catch {
      setError("Your password could not be changed. Try again.");
      setErrorField("currentPassword");
      currentPasswordRef.current?.focus();
    }

    setPending(false);
  };

  return (
    <form onSubmit={submit}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="current-password">
            Temporary password
          </label>
          <div>
            <PasswordInput
              aria-describedby={
                errorField === "currentPassword"
                  ? "change-password-error"
                  : undefined
              }
              aria-invalid={errorField === "currentPassword" ? true : undefined}
              autoComplete="current-password"
              id="current-password"
              maxLength={128}
              name="currentPassword"
              ref={currentPasswordRef}
              required
              visibilityLabel="temporary password"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="new-password">
            New password
          </label>
          <div>
            <PasswordInput
              autoComplete="new-password"
              id="new-password"
              maxLength={128}
              minLength={12}
              name="newPassword"
              required
              visibilityLabel="new password"
            />
          </div>
          <p className="text-xs leading-4 text-muted-foreground">
            Use 12 to 128 characters.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="confirm-password">
            Confirm new password
          </label>
          <div>
            <PasswordInput
              aria-describedby={
                errorField === "confirmPassword"
                  ? "change-password-error"
                  : undefined
              }
              aria-invalid={errorField === "confirmPassword" ? true : undefined}
              autoComplete="new-password"
              id="confirm-password"
              maxLength={128}
              minLength={12}
              name="confirmPassword"
              ref={confirmPasswordRef}
              required
              visibilityLabel="confirmation password"
            />
          </div>
        </div>
        <FieldError id="change-password-error">{error}</FieldError>
        <Button
          aria-busy={pending}
          className="h-10 w-full"
          disabled={pending}
          type="submit"
        >
          {pending ? "Updating password…" : "Set new password"}
        </Button>
        <p aria-live="polite" className="sr-only">
          {pending ? "Updating your password" : ""}
        </p>
      </div>
    </form>
  );
};

export { ChangePasswordForm };
