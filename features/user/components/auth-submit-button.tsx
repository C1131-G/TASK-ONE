/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css. */

import { ArrowRight, CircleNotch } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

const AuthSubmitButton = ({
  idleLabel,
  pending,
  pendingLabel,
}: {
  readonly idleLabel: string;
  readonly pending: boolean;
  readonly pendingLabel: string;
}) => (
  <Button
    aria-busy={pending}
    className="auth-submit"
    disabled={pending}
    type="submit"
  >
    {pending ? (
      <CircleNotch
        aria-hidden="true"
        className="auth-spin"
        size={15}
        weight="bold"
      />
    ) : null}
    {pending ? pendingLabel : idleLabel}
    {pending ? null : (
      <ArrowRight
        aria-hidden="true"
        className="auth-submit-arrow"
        size={15}
        weight="bold"
      />
    )}
  </Button>
);

export { AuthSubmitButton };
