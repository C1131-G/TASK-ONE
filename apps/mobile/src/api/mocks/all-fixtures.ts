import type { MockFixture } from "@/api/mock/mock-fetch";
import { NOTIFICATION_FIXTURES } from "@/api/mocks/notifications";
import { PORTAL_FIXTURES } from "@/api/mocks/portal";
import { PORTAL_MORE_FIXTURES } from "@/api/mocks/portal-more";
import { TASK_FIXTURES } from "@/api/mocks/tasks";
import { WORKSPACE_FIXTURES } from "@/api/mocks/workspace";
import { WORKSPACE_DOMAIN_FIXTURES } from "@/api/mocks/workspace-domains";
import { WORKSPACE_MORE_FIXTURES } from "@/api/mocks/workspace-more";

/** Every fixture the hybrid build serves for routes the server lacks. */
export const ALL_FIXTURES: readonly MockFixture[] = [
  ...NOTIFICATION_FIXTURES,
  ...PORTAL_FIXTURES,
  ...PORTAL_MORE_FIXTURES,
  ...TASK_FIXTURES,
  ...WORKSPACE_FIXTURES,
  ...WORKSPACE_DOMAIN_FIXTURES,
  ...WORKSPACE_MORE_FIXTURES,
];
