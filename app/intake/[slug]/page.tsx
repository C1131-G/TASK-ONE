import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { IntakeFormSkeleton } from "@/features/intake/components/intake-form";
import { IntakeFormSection } from "@/features/intake/components/intake-form-section";
import { AuthCard } from "@/features/user/components/auth-card";

// The link is a capability: keep it out of search results and referrers.
export const metadata: Metadata = {
  description: "Report a problem to the team.",
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Report a problem | Metsys",
};

const Page = ({ params }: PageProps<"/intake/[slug]">) => (
  <PageTransition>
    <AuthCard
      description="Tell us what went wrong and the team will take a look."
      title="Report a problem"
      titleId="intake-title-heading"
    >
      <SuspenseReveal fallback={<IntakeFormSkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {params.then(({ slug }) => (
          <IntakeFormSection slug={slug} />
        ))}
      </SuspenseReveal>
    </AuthCard>
  </PageTransition>
);

export default Page;
