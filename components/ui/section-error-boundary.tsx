"use client";

import { catchError, type ErrorInfo } from "next/error";
import { useTransition } from "react";

const SectionErrorFallback = (
  { title }: { readonly title: string },
  { retry }: ErrorInfo
) => {
  const [pending, startTransition] = useTransition();

  return (
    <section aria-live="polite" className="panel panel-b" role="alert">
      <h2>{title}</h2>
      <p>This section could not be loaded. Retrying is safe.</p>
      <button
        aria-busy={pending}
        disabled={pending}
        onClick={() => startTransition(() => retry())}
        type="button"
      >
        {pending ? "Retrying…" : "Try again"}
      </button>
    </section>
  );
};

export const SectionErrorBoundary = catchError(SectionErrorFallback);
