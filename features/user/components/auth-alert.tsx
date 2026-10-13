/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css. */

import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

// Always rendered so the alert region exists before a message arrives.
const AuthAlert = ({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string;
}) => (
  <p className="auth-alert" id={id} role="alert">
    {message ? (
      <>
        <WarningCircle aria-hidden="true" size={15} weight="bold" />
        <span>{message}</span>
      </>
    ) : null}
  </p>
);

export { AuthAlert };
