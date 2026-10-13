/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css to match the reference UI. */

import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

const steps = [
  {
    detail: "Your administrator creates your employee account.",
    title: "Ask your administrator",
  },
  {
    detail: "They share your work email and a temporary password.",
    title: "Get your sign-in details",
  },
  {
    detail: "Sign in once, then choose a password only you know.",
    title: "Set your own password",
  },
] as const;

const RequestAccessSteps = () => (
  <>
    <ol className="auth-steps">
      {steps.map((step, index) => (
        <li key={step.title}>
          <span aria-hidden="true" className="auth-step-num">
            {index + 1}
          </span>
          <span className="auth-step-copy">
            <b>{step.title}</b>
            <span>{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
    <Link className="auth-submit auth-submit-link" href="/login">
      Back to sign in
      <ArrowRight
        aria-hidden="true"
        className="auth-submit-arrow"
        size={15}
        weight="bold"
      />
    </Link>
    <div aria-hidden="true" className="auth-divider" />
    <p className="auth-foot-note">
      Already have an account?{" "}
      <Link className="auth-link" href="/login">
        Sign in
      </Link>
    </p>
  </>
);

export { RequestAccessSteps };
