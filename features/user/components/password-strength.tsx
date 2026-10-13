/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css. */

import { MIN_LENGTH, scorePassword } from "@/features/user/password-score";
import type { PasswordScore } from "@/features/user/password-score";

const METER_BARS = [1, 2, 3, 4] as const;
const LEVEL_LABELS = {
  0: "Too short",
  1: "Fair",
  2: "Good",
  3: "Strong",
} as const satisfies Record<PasswordScore, string>;

const PasswordStrength = ({ password }: { readonly password: string }) => {
  if (!password) {
    return (
      <p className="auth-hint" id="new-password-hint">
        Use {MIN_LENGTH} to 128 characters.
      </p>
    );
  }

  const score = scorePassword(password);

  return (
    <div className="auth-strength" data-level={score} id="new-password-hint">
      <div aria-hidden="true" className="auth-strength-bars">
        {METER_BARS.map((segment) => (
          <i data-on={segment <= score + 1} key={segment} />
        ))}
      </div>
      <span aria-live="polite" className="auth-strength-label">
        {LEVEL_LABELS[score]}
      </span>
    </div>
  );
};

export { PasswordStrength };
