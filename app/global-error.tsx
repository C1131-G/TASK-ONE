"use client";

import Link from "next/link";
import { useTransition } from "react";

import "./globals.css";
import { buttonVariants } from "@/components/ui/button";

// Replaces the root layout when it fails, so it renders its own document and
// mirrors RouteError's copy and structure.
const GlobalError = ({ retry }: { readonly retry: () => void }) => {
  const [pending, startTransition] = useTransition();

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <title>Application error | Metsys</title>
        <main className="grid min-h-dvh place-items-center p-6">
          <section
            aria-live="polite"
            className="grid max-w-md gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
            role="alert"
          >
            <h1 className="font-heading text-2xl">Application error</h1>
            <p className="text-muted-foreground">
              Something went wrong. Retrying is safe.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                aria-busy={pending}
                className={buttonVariants()}
                disabled={pending}
                onClick={() => startTransition(() => retry())}
                type="button"
              >
                {pending ? "Retrying…" : "Try again"}
              </button>
              <Link className={buttonVariants({ variant: "outline" })} href="/">
                Go to home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
