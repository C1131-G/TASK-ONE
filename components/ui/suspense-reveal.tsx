import type { ReactNode } from "react";
import { Suspense, ViewTransition } from "react";

// A Suspense boundary whose content rises in when it replaces the skeleton.
// The skeleton has no exit animation: the live root swaps it out in place.
// Revalidations keep `default="none"`, so refreshed content never re-animates.
export const SuspenseReveal = ({
  children,
  fallback,
}: {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}) => (
  <Suspense fallback={fallback}>
    <ViewTransition default="none" enter="reveal">
      {children}
    </ViewTransition>
  </Suspense>
);
