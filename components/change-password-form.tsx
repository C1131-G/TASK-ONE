"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { changeOwnPasswordAction } from "@/app/actions/password";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="current-password">Temporary password</FieldLabel>
          <Input
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
            required
            type="password"
            ref={currentPasswordRef}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input
            autoComplete="new-password"
            id="new-password"
            maxLength={128}
            minLength={12}
            name="newPassword"
            required
            type="password"
          />
          <FieldDescription>Use 12 to 128 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">
            Confirm new password
          </FieldLabel>
          <Input
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
            required
            type="password"
            ref={confirmPasswordRef}
          />
        </Field>
        <FieldError id="change-password-error">{error}</FieldError>
        <Button
          aria-busy={pending}
          className="h-11 w-full"
          disabled={pending}
          type="submit"
        >
          {pending ? "Updating password…" : "Set new password"}
        </Button>
        <p aria-live="polite" className="sr-only">
          {pending ? "Updating your password" : ""}
        </p>
      </FieldGroup>
    </form>
  );
};

export { ChangePasswordForm };
