"use client";

import { useTransition } from "react";

export const RouteError = ({
  reset,
  title,
}: {
  readonly reset: () => void;
  readonly title: string;
}) => {
  const [pending, startTransition] = useTransition();

  return (
    <main className="page">
      <section aria-live="polite" className="panel panel-b" role="alert">
        <h1>{title}</h1>
        <p>Something went wrong. Retrying is safe.</p>
        <button
          aria-busy={pending}
          disabled={pending}
          onClick={() => startTransition(() => reset())}
          type="button"
        >
          {pending ? "Retrying…" : "Try again"}
        </button>
      </section>
    </main>
  );
};
