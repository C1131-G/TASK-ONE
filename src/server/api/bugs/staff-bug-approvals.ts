import { Effect } from "effect";

import { staffBugApprovalInboxRoute } from "../../../mobile-api/routes-bugs";
import { BugApprovalInbox } from "../../work/bug-approval-inbox";
import { pageOf } from "../paging";
import { asStaffCaller } from "./caller";

// The admin's bug-approval inbox, newest submission first, one page at a time.
export const listBugApprovals = (request: Request) =>
  asStaffCaller(staffBugApprovalInboxRoute, request, {}, ({ input, user }) =>
    Effect.gen(function* list() {
      const inbox = yield* BugApprovalInbox;
      const approvals = yield* inbox.list(user.id);
      return yield* pageOf(approvals, ({ id }) => id, input.query);
    })
  );
