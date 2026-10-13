"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { AuthBrand } from "@/components/auth-brand";
import { AuthVisualPanel } from "@/components/auth-visual-panel";
import { PasswordInput } from "@/components/password-input";
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
      }
    } catch {
      setError("Sign-in is temporarily unavailable. Try again in a moment.");
      passwordRef.current?.focus();
    }

    setPending(false);
  };

  return (
    <div className="login-layout">
      <section aria-labelledby="login-title" className="login-panel">
        <AuthBrand />
        <div className="login-intro">
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in with your work account to continue.</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-field">
            <label htmlFor="login-email">Work email</label>
            <input
              autoComplete="username"
              autoCapitalize="none"
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
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
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
          {error ? (
            <p className="login-error" id="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            aria-busy={pending}
            className="login-submit"
            disabled={pending}
            type="submit"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <p aria-live="polite" className="sr-only">
            {pending ? "Signing in" : ""}
          </p>
        </form>
        <p className="login-access">
          Need an account? <Link href="/signup">Request access</Link>
        </p>
      </section>
      <AuthVisualPanel mode="login" />
    </div>
  );
};

export { LoginForm };
