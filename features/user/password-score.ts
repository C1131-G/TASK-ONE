// Mirrors the server rule (12 to 128 characters) and rewards extra variety.
const MIN_LENGTH = 12;
const LONG_LENGTH = 16;
const HAS_LETTER = /[a-z]/iu;
const HAS_DIGIT = /\d/u;
const HAS_SYMBOL = /[^a-z\d]/iu;
const HAS_MIXED_CASE = /(?=.*[a-z])(?=.*[A-Z])/u;

type PasswordScore = 0 | 1 | 2 | 3;

const scorePassword = (password: string): PasswordScore => {
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

export { MIN_LENGTH, scorePassword };
export type { PasswordScore };
