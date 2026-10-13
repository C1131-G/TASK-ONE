/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css. */

import type { ReactNode } from "react";

// Static card chrome: it paints in the shell while the body behind it suspends.
const AuthCard = ({
  badge,
  children,
  description,
  title,
  titleId,
}: {
  readonly badge?: ReactNode;
  readonly children: ReactNode;
  readonly description: string;
  readonly title: string;
  readonly titleId: string;
}) => (
  <section aria-labelledby={titleId} className="auth-card">
    <div className="auth-head">
      {badge ? (
        <span aria-hidden="true" className="auth-badge">
          {badge}
        </span>
      ) : null}
      <h1 id={titleId}>{title}</h1>
      <p>{description}</p>
    </div>
    {children}
  </section>
);

export { AuthCard };
