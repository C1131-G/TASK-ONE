import { Effect } from "effect";

import { staffBugListRoute } from "../../../mobile-api/routes-bugs";
import { listStaffBugs } from "../../work/bug-staff-list";
import { asStaffCaller } from "./caller";

// The staff bug list. Who sees which bug is decided in the service, from the
// signed-in caller alone.
export const listWorkspaceBugs = (request: Request) =>
  asStaffCaller(staffBugListRoute, request, {}, ({ input, user }) =>
    Effect.suspend(() => listStaffBugs(user.id, input.query))
  );
