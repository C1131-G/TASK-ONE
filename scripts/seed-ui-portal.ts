import { Effect } from "effect";

import { db } from "../src/prisma/db";
import { submitBug } from "../src/server/portal/portal-bug-submission";
import { findProjectId } from "./seed-ui-projects";

const CLIENT_PROJECT_KEY = "ACMEP";
const CLIENT_BUG_TITLE = "Portal fixture bug";

// Files one bug as a client, so the portal has a record to open. Found by its
// title, so rerunning the seed adds it once.
export const seedPortalBug = (clientId: string) =>
  Effect.gen(function* seedPortalFixtures() {
    const client = yield* Effect.promise(() =>
      db.orm.public.User.where({ id: clientId })
        .select("clientCompanyId", "name")
        .first()
    );
    if (!client?.clientCompanyId) {
      throw new Error("The portal fixture account must belong to a company.");
    }
    const projectId = yield* findProjectId(CLIENT_PROJECT_KEY);
    if (!projectId) {
      throw new Error("Seed the e2e accounts before the portal fixtures.");
    }
    const existing = yield* Effect.promise(() =>
      db.orm.public.Task.where({ projectId, title: CLIENT_BUG_TITLE })
        .select("id")
        .first()
    );
    if (existing) {
      process.stdout.write("Portal fixture already seeded.\n");
      return;
    }
    yield* submitBug(
      {
        clientCompanyId: client.clientCompanyId,
        id: clientId,
        name: client.name,
      },
      {
        actualBehavior: "The invoice total is blank after saving.",
        browser: null,
        description: null,
        device: null,
        expectedBehavior: "The invoice total shows the saved amount.",
        impact: "medium",
        os: null,
        pageUrl: "https://app.example.test/invoices",
        projectId,
        reproductionSteps: ["Open an invoice.", "Save it."],
        title: CLIENT_BUG_TITLE,
      }
    );
    process.stdout.write("Seeded a client bug for the portal.\n");
  });
