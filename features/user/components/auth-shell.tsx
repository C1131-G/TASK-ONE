/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css to match the reference UI. */

import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { AuthThemeToggle } from "@/features/user/components/auth-theme-toggle";
import { AuthTopActions } from "@/features/user/components/auth-top-actions";

import "@/features/user/styles/auth-shell.css";
import "@/features/user/styles/auth-card.css";
import "@/features/user/styles/auth-controls.css";

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
    Taskora
  </span>
);

const AuthShell = ({ children }: { readonly children: ReactNode }) => (
  <div className="auth-app">
    <a
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
      href="#auth-main"
    >
      Skip to main content
    </a>
    <header className="auth-top">
      <AuthLogo />
      <div className="auth-top-actions">
        <AuthTopActions />
        <AuthThemeToggle />
      </div>
    </header>
    <main className="auth-main" id="auth-main" tabIndex={-1}>
      {children}
    </main>
    <footer className="auth-foot">
      <LockSimple aria-hidden="true" size={12} weight="bold" />
      Secured workspace sign-in · Taskora
    </footer>
  </div>
);

export { AuthShell };
