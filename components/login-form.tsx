"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ComponentProps, FormEvent } from "react";

import { AuthBrand } from "@/components/auth-brand";
import { AuthVisualPanel } from "@/components/auth-visual-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { authClient } from "@/src/client/auth-client";

const LoginForm = ({ className, ...props }: ComponentProps<"div">) => {
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card size="auth">
        <CardContent className="grid md:grid-cols-[0.95fr_1.05fr]" size="flush">
          <form
            className="flex flex-col justify-center p-6 sm:p-8 lg:p-8"
            onSubmit={submit}
          >
            <div className="mb-8 md:hidden">
              <AuthBrand />
            </div>
            <FieldGroup density="auth">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                  Employee sign in
                </p>
                <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                  Welcome back
                </h1>
                <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                  Sign in with your work account to continue.
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="login-email">Work email</FieldLabel>
                <Input
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  id="login-email"
                  maxLength={320}
                  name="email"
                  placeholder="you@company.com"
                  required
                  spellCheck={false}
                  type="email"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Input
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={error ? true : undefined}
                  autoComplete="current-password"
                  id="login-password"
                  maxLength={128}
                  name="password"
                  placeholder="Enter your password"
                  ref={passwordRef}
                  required
                  type="password"
                />
              </Field>
              <FieldError id="login-error">{error}</FieldError>
              <Field>
                <Button
                  className="h-11 w-full"
                  disabled={pending}
                  type="submit"
                  aria-busy={pending}
                >
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
              </Field>
              <p aria-live="polite" className="sr-only">
                {pending ? "Signing in" : ""}
              </p>
              <FieldDescription className="text-center">
                Need an account?{" "}
                <Link
                  className="font-medium text-foreground underline"
                  href="/signup"
                >
                  Request access
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>
          <AuthVisualPanel mode="login" />
        </CardContent>
      </Card>
    </div>
  );
};

export { LoginForm };
