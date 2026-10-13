"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Auth screens are styled by app/auth.css to match the reference UI. */

import { ArrowRight, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/src/client/auth-client";

const LoginForm = () => {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

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
        router.replace("/");
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
    <section aria-labelledby="login-title" className="auth-card">
      <div className="auth-head">
        <h1 id="login-title">Welcome back</h1>
        <p>Sign in to your Metsys workspace</p>
      </div>
      <p className="auth-alert" id="login-error" role="alert">
        {error ? (
          <>
            <WarningCircle aria-hidden="true" size={15} weight="bold" />
            <span>{error}</span>
          </>
        ) : null}
      </p>
      <form className="auth-form" onSubmit={submit}>
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
        <Button
          aria-busy={pending}
          className="auth-submit"
          disabled={pending}
          type="submit"
        >
          {pending ? (
            <>
              <CircleNotch
                aria-hidden="true"
                className="auth-spin"
                size={15}
                weight="bold"
              />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight
                aria-hidden="true"
                className="auth-submit-arrow"
                size={15}
                weight="bold"
              />
            </>
          )}
        </Button>
      </form>
      <div aria-hidden="true" className="auth-divider" />
      <p className="auth-foot-note">
        Don&apos;t have an account?{" "}
        <Link className="auth-link" href="/signup">
          Request access
        </Link>
      </p>
    </section>
  );
};

export { LoginForm };
