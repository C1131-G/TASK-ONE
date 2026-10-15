"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css to match the reference UI. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { AuthAlert } from "@/features/user/components/auth-alert";
import {
  AuthFieldSkeleton,
  AuthFormSkeleton,
} from "@/features/user/components/auth-skeleton";
import { AuthSubmitButton } from "@/features/user/components/auth-submit-button";
import { PasswordInput } from "@/features/user/components/password-input";
import { readFormText } from "@/features/user/read-form-text";
import { authClient } from "@/src/client/auth-client";

const subscribeHydration = (onStoreChange: () => void) => {
  window.addEventListener("pageshow", onStoreChange);
  return () => window.removeEventListener("pageshow", onStoreChange);
};
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const LoginForm = () => {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = readFormText(formData, "email").trim();
    const password = readFormText(formData, "password");

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe: false,
      });

      if (result.error) {
        setError(
          result.error.status === 429
            ? "Too many sign-in attempts. Wait a moment, then try again."
            : "We couldn't sign you in. Check your email and password, then try again."
        );
        passwordRef.current?.focus();
      } else {
        // The sign-in page routes a signed-in account to its own home
        // (password change, workspace, or client portal) on the server.
        router.replace("/login");
        router.refresh();
        return;
      }
    } catch {
      setError("Sign-in is temporarily unavailable. Try again in a moment.");
      passwordRef.current?.focus();
    }

    setPending(false);
  };

  return (
    <>
      <AuthAlert id="login-error" message={error} />
      <form
        className="auth-form"
        data-hydrated={hydrated ? "true" : "false"}
        method="post"
        onSubmit={submit}
      >
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">
            Work email
          </label>
          <Input
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            className="auth-input"
            id="login-email"
            maxLength={320}
            name="email"
            onChange={() => setError("")}
            placeholder="you@company.com"
            required
            spellCheck={false}
            type="email"
          />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-password">
            Password
          </label>
          <PasswordInput
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="current-password"
            id="login-password"
            maxLength={128}
            name="password"
            onChange={() => setError("")}
            placeholder="Enter your password"
            ref={passwordRef}
            required
            visibilityLabel="password"
          />
        </div>
        <AuthSubmitButton
          idleLabel="Sign in"
          pending={pending}
          pendingLabel="Signing in…"
        />
      </form>
      <div aria-hidden="true" className="auth-divider" />
      <p className="auth-foot-note">
        Don&apos;t have an account?{" "}
        <Link className="auth-link" href="/signup">
          Request access
        </Link>
      </p>
    </>
  );
};

const LoginFormSkeleton = () => (
  <>
    <AuthFormSkeleton>
      <AuthFieldSkeleton />
      <AuthFieldSkeleton />
    </AuthFormSkeleton>
    <div aria-hidden="true" className="auth-divider" />
    <span className="auth-skeleton-text auth-skeleton-note" />
  </>
);

export { LoginForm, LoginFormSkeleton };
