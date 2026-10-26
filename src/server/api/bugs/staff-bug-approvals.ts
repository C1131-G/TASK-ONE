import { Effect } from "effect";

import { staffBugApprovalInboxRoute } from "../../../mobile-api/routes-bugs";
import { BugApprovalInbox } from "../../work/bug-approval-inbox";
import { asStaffCaller } from "./caller";

// The admin's bug-approval inbox, newest submission first.
export const listBugApprovals = (request: Request) =>
  asStaffCaller(staffBugApprovalInboxRoute, request, {}, ({ user }) =>
    Effect.gen(function* list() {
      const inbox = yield* BugApprovalInbox;
      return { items: yield* inbox.list(user.id) };
    })
  );
