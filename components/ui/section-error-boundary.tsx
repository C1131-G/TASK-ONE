"use client";

import { catchError, type ErrorInfo } from "next/error";
import { useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";

// The title names what failed ("Projects couldn't load"); the body only says
// what to do next, so it never repeats the title.
const SectionErrorFallback = (
  { title }: { readonly title: string },
  { retry }: ErrorInfo
) => {
  const [pending, startTransition] = useTransition();

  return (
    <section aria-live="polite" className="panel panel-b" role="alert">
      <h2>{title}</h2>
      <p>Something went wrong on our side. Trying again is safe.</p>
      <WorkspaceButton
        aria-busy={pending || undefined}
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={() => startTransition(() => retry())}
        type="button"
      >
        {pending ? "Retrying…" : "Try again"}
      </WorkspaceButton>
    </section>
  );
};

export const SectionErrorBoundary = catchError(SectionErrorFallback);
