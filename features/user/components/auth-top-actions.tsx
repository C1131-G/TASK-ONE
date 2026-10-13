"use client";

/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css. */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthSignOutButton } from "@/features/user/components/auth-sign-out-button";

// The shell persists across auth routes, so the top-right action follows the URL.
const AuthTopActions = () => {
  const pathname = usePathname();

  if (pathname === "/change-password") {
    return <AuthSignOutButton />;
  }
  if (pathname === "/signup") {
    return (
      <Link className="auth-ghost" href="/login">
        Sign in
      </Link>
    );
  }
  return (
    <Link className="auth-ghost" href="/signup">
      Request access
    </Link>
  );
};

export { AuthTopActions };
