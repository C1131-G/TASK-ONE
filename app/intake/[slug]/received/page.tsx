/* eslint-disable shadcn/no-unknown-classes -- Public intake screens reuse the auth chrome styles. */

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { AuthCard } from "@/features/user/components/auth-card";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Report received | Metsys",
};

const REFERENCE_PATTERN = /^INT-[A-Z0-9]{8}$/u;

// The reference comes from the address bar, so only the exact shape is shown.
const ReferenceNote = ({ reference }: { readonly reference: unknown }) =>
  typeof reference === "string" && REFERENCE_PATTERN.test(reference) ? (
    <p className="auth-foot-note">
      Your reference is{" "}
      <strong data-testid="intake-reference">{reference}</strong>. Quote it if
      you contact us about this report.
    </p>
  ) : null;

const Page = ({ searchParams }: PageProps<"/intake/[slug]/received">) => (
  <PageTransition>
    <AuthCard
      badge={<CheckCircle size={22} weight="duotone" />}
      description="The team has been told and will review it."
      title="Thank you, your report was received"
      titleId="intake-received-title"
    >
      <SuspenseReveal fallback={<span className="auth-skeleton-text" />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {searchParams.then(({ ref }) => (
          <ReferenceNote reference={ref} />
        ))}
      </SuspenseReveal>
    </AuthCard>
  </PageTransition>
);

export default Page;
