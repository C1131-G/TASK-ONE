import { Effect } from "effect";

import { staffBugContextRoute } from "../../../mobile-api/routes-bugs";
import { BugHistory } from "../../work/bug-history";
import { asStaffCaller } from "./caller";
import type { PathParams } from "./caller";

// A staff member opens a bug: the same history the web drawer shows, with the
// client context and the staff-only fields.
export const getWorkspaceBug = (request: Request, params: PathParams) =>
  asStaffCaller(staffBugContextRoute, request, params, ({ input, user }) =>
    Effect.gen(function* read() {
      const history = yield* BugHistory;
      return yield* history.get(user.id, input.params.bugId);
    })
  );
