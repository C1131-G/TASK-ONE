/* eslint-disable shadcn/no-unknown-classes -- Public intake screens reuse the auth chrome styles. */

import { notFound } from "next/navigation";
import { connection } from "next/server";

import { IntakeForm } from "@/features/intake/components/intake-form";
import { isPlausibleIntakeSlug } from "@/features/intake/intake-form-url";
import {
  getPublicIntakeForm,
  issueIntakeFormToken,
} from "@/features/intake/intake-public-queries";

// The signed issue time makes this page per-request, so it opts out of
// prerendering before it reads the clock.
const IntakeFormSection = async ({ slug }: { readonly slug: string }) => {
  if (!isPlausibleIntakeSlug(slug)) {
    notFound();
  }
  await connection();
  const form = await getPublicIntakeForm(slug);
  return (
    <>
      <p className="auth-foot-note">
        {form.name} · for {form.companyName}
      </p>
      <IntakeForm formToken={issueIntakeFormToken(slug)} slug={slug} />
    </>
  );
};

export { IntakeFormSection };
