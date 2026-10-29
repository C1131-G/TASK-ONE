/* eslint-disable shadcn/no-unknown-classes -- Public intake screens reuse the auth chrome styles. */

import type { ReactNode } from "react";

import "@/features/user/styles/auth-shell.css";
import "@/features/user/styles/auth-card.css";
import "@/features/user/styles/auth-controls.css";

// The public page chrome: no sign-in prompts, since the visitor has no account.
const IntakeShell = ({ children }: { readonly children: ReactNode }) => (
  <div className="auth-app">
    <header className="auth-top">
      <span className="auth-logo">
        <span aria-hidden="true" className="auth-logo-mark">
          <svg fill="none" viewBox="0 0 24 24">
            <path
              d="M4.5 18V6l7.5 7 7.5-7v12"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
            />
          </svg>
        </span>
        Taskora
      </span>
    </header>
    <main className="auth-main" id="intake-main" tabIndex={-1}>
      {children}
    </main>
  </div>
);

export { IntakeShell };
