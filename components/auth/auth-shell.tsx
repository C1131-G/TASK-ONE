/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by app/auth.css to match the reference UI. */

import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle";

import "@/app/auth.css";

interface AuthShellProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly mainId: string;
  readonly page: string;
}

const AuthLogo = () => (
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
    Metsys
  </span>
);

const AuthShell = ({ actions, children, mainId, page }: AuthShellProps) => (
  <div className="auth-app" data-auth-page={page}>
    <a
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
      href={`#${mainId}`}
    >
      Skip to main content
    </a>
    <header className="auth-top">
      <AuthLogo />
      <div className="auth-top-actions">
        {actions}
        <AuthThemeToggle />
      </div>
    </header>
    <main className="auth-main" id={mainId} tabIndex={-1}>
      {children}
    </main>
    <footer className="auth-foot">
      <LockSimple aria-hidden="true" size={12} weight="bold" />
      Secured workspace sign-in · Metsys
    </footer>
  </div>
);

export { AuthShell };
