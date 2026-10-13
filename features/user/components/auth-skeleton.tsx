/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css. */

import type { ReactNode } from "react";

// Placeholders mirror the real auth form rows so the card keeps its height.
const AuthFieldSkeleton = ({
  withHint = false,
}: {
  readonly withHint?: boolean;
}) => (
  <div className="auth-field">
    <span className="auth-skeleton-text auth-skeleton-label" />
    <span className="auth-skeleton-input" />
    {withHint ? (
      <span className="auth-skeleton-text auth-skeleton-hint" />
    ) : null}
  </div>
);

const AuthFormSkeleton = ({ children }: { readonly children: ReactNode }) => (
  <div aria-busy="true" className="auth-form">
    <span className="sr-only">Checking your session…</span>
    {children}
    <span className="auth-skeleton-button" />
  </div>
);

export { AuthFieldSkeleton, AuthFormSkeleton };
