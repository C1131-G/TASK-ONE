import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  callAs,
  ids,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { refreshes, revalidatedPaths } from "./support/next-cache-mock";

const projects = await import("../../features/projects/projects-actions");
const projectsQueries =
  await import("../../features/projects/projects-queries");

beforeAll(setupHarness);
afterAll(async () => {
  await teardownHarness();
});

const budgetInput = {
  billableOnly: false,
  budgetMinutes: 1200,
  currency: "EUR",
  hourlyRateCents: 8000,
  kind: "retainer",
  warningPercent: 75,
};

it("replays budget changes and asks the project pages to refresh", async () => {
  const refreshesBefore = refreshes.count;
  const saved = await replay(
    "saveProjectBudgetAction",
    "admin",
    projects.saveProjectBudgetAction,
    { ...budgetInput, projectId: ids.projectId }
  );
  expect(saved).toMatchObject({ budgetMinutes: 1200, kind: "retainer" });
  expect(refreshes.count).toBeGreaterThan(refreshesBefore);
  expect(revalidatedPaths).toContain(`/projects/${ids.projectId}`);

  const read = await callAs("admin", projectsQueries.getProjectBudget, {
    projectId: ids.projectId,
  });
  expect(read).toMatchObject({
    data: { currency: "EUR", warningPercent: 75 },
    ok: true,
  });

  await replay(
    "clearProjectBudgetAction",
    "admin",
    projects.clearProjectBudgetAction,
    { projectId: ids.projectId }
  );
  const cleared = await callAs("admin", projectsQueries.getProjectBudget, {
    projectId: ids.projectId,
  });
  expect(cleared).toMatchObject({ data: null, ok: true });
});

it("keeps budgets away from employees who are not on the project", async () => {
  const outsider = await callAs("outsider", projectsQueries.getProjectBudget, {
    projectId: ids.projectId,
  });
  expect(outsider).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});
