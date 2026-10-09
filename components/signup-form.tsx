import Link from "next/link";
import type { ComponentProps } from "react";

import { AuthBrand } from "@/components/auth-brand";
import { AuthVisualPanel } from "@/components/auth-visual-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const SignupForm = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-6", className)} {...props}>
    <Card size="auth">
      <CardContent className="grid md:grid-cols-[0.95fr_1.05fr]" size="flush">
        <section
          aria-labelledby="signup-title"
          className="flex flex-col justify-center p-6 sm:p-8 lg:p-10"
        >
          <div className="mb-8 md:hidden">
            <AuthBrand />
          </div>
          <FieldGroup density="auth">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                Employee access
              </p>
              <h1
                className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
                id="signup-title"
              >
                Request access
              </h1>
              <p className="max-w-xs text-sm leading-6 text-balance text-muted-foreground">
                Metsys accounts are created by an administrator.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-muted/60 p-4 text-sm leading-6 text-secondary-foreground">
              Ask your administrator to create your employee account. They’ll
              provide your work email and a temporary password for your first
              sign-in.
            </div>
            <Button asChild className="h-11 w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
            <FieldDescription className="text-center">
              Already have an account?{" "}
              <Link
                className="font-medium text-foreground underline"
                href="/login"
              >
                Sign in
              </Link>
            </FieldDescription>
          </FieldGroup>
        </section>
        <AuthVisualPanel mode="signup" />
      </CardContent>
    </Card>
  </div>
);

export { SignupForm };
