/* eslint-disable shadcn/no-unknown-classes -- Auth screens are styled by app/auth.css. */

const MIN_LENGTH = 12;
const LONG_LENGTH = 16;
const METER_BARS = [1, 2, 3, 4] as const;
const HAS_LETTER = /[a-z]/iu;
const HAS_DIGIT = /\d/u;
const HAS_SYMBOL = /[^a-z\d]/iu;
const HAS_MIXED_CASE = /(?=.*[a-z])(?=.*[A-Z])/u;

const LEVEL_LABELS = ["Too short", "Fair", "Good", "Strong"] as const;

const scorePassword = (password: string): number => {
  if (password.length < MIN_LENGTH) {
    return 0;
  }
  const extras = [
    password.length >= LONG_LENGTH,
    HAS_LETTER.test(password) && HAS_DIGIT.test(password),
    HAS_SYMBOL.test(password),
    HAS_MIXED_CASE.test(password),
  ].filter(Boolean).length;
  if (extras >= 3) {
    return 3;
  }
  return extras >= 1 ? 2 : 1;
};

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
