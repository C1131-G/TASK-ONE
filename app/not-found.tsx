/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css. */

import { ArrowRight, Compass } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/user/components/auth-card";
import { AuthShell } from "@/features/user/components/auth-shell";

export const metadata: Metadata = { title: "Not found | Metsys" };

// Unmatched URLs render outside the workspace shell, so this uses the public chrome.
const RootNotFound = () => (
  <AuthShell>
    <AuthCard
      badge={<Compass size={22} weight="duotone" />}
      description="The link may be wrong, or the page may have moved."
      title="Page not found"
      titleId="not-found-title"
    >
      <Link className="auth-submit auth-submit-link" href="/">
        Go to Metsys
        <ArrowRight
          aria-hidden="true"
          className="auth-submit-arrow"
          size={16}
          weight="bold"
        />
      </Link>
    </AuthCard>
  </AuthShell>
);

export default RootNotFound;
