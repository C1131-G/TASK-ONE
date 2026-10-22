export const INTAKE_PATH_PREFIX = "/intake/";

const MIN_SLUG_LENGTH = 16;
const MAX_SLUG_LENGTH = 200;
const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/u;

export const intakeFormPath = (slug: string): string =>
  `${INTAKE_PATH_PREFIX}${slug}`;

export const intakeFormUrl = (origin: string, slug: string): string =>
  `${origin.replace(/\/+$/u, "")}${intakeFormPath(slug)}`;

// A cheap shape check before any lookup; real slugs are long and URL-safe.
export const isPlausibleIntakeSlug = (slug: string): boolean =>
  slug.length >= MIN_SLUG_LENGTH &&
  slug.length <= MAX_SLUG_LENGTH &&
  SLUG_PATTERN.test(slug);
