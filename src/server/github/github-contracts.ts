import { Schema } from "effect";

import { UUIDSchema } from "../core/input-schemas";

export const PULL_STATES = ["open", "closed", "merged"] as const;
export type PullState = (typeof PULL_STATES)[number];

export const GITHUB_ROUTE_PATH = "/api/integrations/github";

// GitHub owner and repository names: letters, digits, `.`, `_` and `-`.
const REPO_FULL_NAME_PATTERN =
  /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/u;
const REPO_MESSAGE =
  "Enter the repository as owner/name, for example acme/web.";

/** The stored form of a repository name; GitHub compares names without case. */
export const normalizeRepoFullName = (value: string): string =>
  value.trim().toLowerCase();

export const isRepoFullName = (value: string): boolean =>
  REPO_FULL_NAME_PATTERN.test(value.trim());

const RepoFullNameSchema = Schema.String.check(
  Schema.makeFilter((value) =>
    isRepoFullName(value) ? undefined : REPO_MESSAGE
  )
);

export const GithubConnectionInputSchema = Schema.Struct({
  autoCompleteOnMerge: Schema.Boolean,
  projectId: UUIDSchema,
  repoFullName: RepoFullNameSchema,
});
export type GithubConnectionInput = typeof GithubConnectionInputSchema.Type;

export const GithubConnectionChangesSchema = Schema.Struct({
  autoCompleteOnMerge: Schema.Boolean,
  enabled: Schema.Boolean,
});
export type GithubConnectionChanges = typeof GithubConnectionChangesSchema.Type;

export const GithubConnectionSummarySchema = Schema.Struct({
  autoCompleteOnMerge: Schema.Boolean,
  createdAt: Schema.String,
  enabled: Schema.Boolean,
  id: Schema.String,
  projectId: Schema.String,
  projectKey: Schema.String,
  projectName: Schema.String,
  repoFullName: Schema.String,
  secretHint: Schema.String,
});
export type GithubConnectionSummary = typeof GithubConnectionSummarySchema.Type;

export const GithubConnectionListSchema = Schema.Array(
  GithubConnectionSummarySchema
);

export const GithubConnectionCreatedSchema = Schema.Struct({
  connection: GithubConnectionSummarySchema,
  // Shown once; only an encrypted copy is stored.
  secret: Schema.String,
});
export type GithubConnectionCreated = typeof GithubConnectionCreatedSchema.Type;

export const GithubSecretSchema = Schema.Struct({ secret: Schema.String });

export const LinkedPullSchema = Schema.Struct({
  authorLogin: Schema.NullOr(Schema.String),
  id: Schema.String,
  number: Schema.Number,
  repoFullName: Schema.String,
  state: Schema.Literals(PULL_STATES),
  title: Schema.String,
  updatedAt: Schema.String,
  url: Schema.String,
});
export type LinkedPull = typeof LinkedPullSchema.Type;

export const LinkedPullListSchema = Schema.Array(LinkedPullSchema);
