import type { MockFixture } from "@/api/mock/mock-fetch";

export const WORKSPACE_MORE_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      items: [
        {
          bugTitle: "Login rejects valid passwords on Android",
          id: "ba-1",
          projectName: "Website relaunch",
          reportedBy: "Client Carl",
          status: "pending",
        },
        {
          bugTitle: "Approval button double-fires",
          id: "ba-2",
          projectName: "Client portal",
          reportedBy: "Client Carl",
          status: "approved",
        },
      ],
    },
    operationId: "listBugApprovals",
  },
];
