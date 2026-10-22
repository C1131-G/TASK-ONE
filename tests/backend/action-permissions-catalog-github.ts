import { entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const githubActions = await import("../../features/github/github-actions");
const githubQueries = await import("../../features/github/github-queries");

// Managing connections is administrator-only; reading a task's linked pull
// requests is open to staff and refused to clients.
export const githubActionCatalog: readonly ActionEntry[] = [
  entry(
    "listGithubConnections",
    githubQueries.listGithubConnections,
    () => ({})
  ),
  entry("getTaskLinkedPulls", githubQueries.getTaskLinkedPulls, () => ({
    taskId: ids.taskId,
  })),
  entry(
    "createGithubConnectionAction",
    githubActions.createGithubConnectionAction,
    () => ({
      autoCompleteOnMerge: false,
      projectId: ids.projectId,
      repoFullName: "acme/permission-probe",
    })
  ),
  entry(
    "updateGithubConnectionAction",
    githubActions.updateGithubConnectionAction,
    () => ({
      autoCompleteOnMerge: false,
      connectionId: ids.random,
      enabled: true,
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "rotateGithubSecretAction",
    githubActions.rotateGithubSecretAction,
    () => ({ connectionId: ids.random })
  ),
];

export const githubAdminOnlyNames: readonly string[] = githubActionCatalog
  .map(({ name }) => name)
  .filter((name) => name !== "getTaskLinkedPulls");
