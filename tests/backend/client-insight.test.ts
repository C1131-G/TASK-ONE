import { expect, it } from "bun:test";

import { companyInsight } from "../../src/server/clients/client-company-insight";
import type { SlaSettings } from "../../src/server/company/sla-settings";
import { callAs, ids } from "./support/action-harness";
import {
  clientQueries,
  installHooks,
} from "./support/client-security-fixtures";

installHooks();

const monday = (time: string) => new Date(`2026-10-05T${time}:00Z`);

const calendar: SlaSettings = {
  calendar: {
    days: [1, 2, 3, 4, 5],
    endMinute: 1080,
    startMinute: 540,
    timeZone: "UTC",
  },
  targets: {
    high: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
    low: { firstResponseMinutes: 1440, resolutionMinutes: 14_400 },
    medium: { firstResponseMinutes: 480, resolutionMinutes: 4800 },
    urgent: { firstResponseMinutes: 60, resolutionMinutes: 480 },
  },
};

it("summarises a company's support from its bugs", () => {
  const insight = companyInsight(
    [
      {
        clientReopenCount: 0,
        resolution: "confirmed",
        satisfaction: "up",
        status: "closed",
      },
      {
        clientReopenCount: 2,
        resolution: null,
        satisfaction: null,
        status: "triaged",
      },
      {
        clientReopenCount: 0,
        resolution: "unconfirmed",
        satisfaction: null,
        status: "closed",
      },
      {
        clientReopenCount: 0,
        resolution: "confirmed",
        satisfaction: "down",
        status: "closed",
      },
      {
        clientReopenCount: 0,
        resolution: null,
        satisfaction: null,
        status: "in_progress",
      },
    ],
    [
      {
        breachedResolution: false,
        breachedResponse: false,
        createdAt: monday("09:00"),
        firstRespondedAt: monday("10:00"),
      },
      {
        breachedResolution: true,
        breachedResponse: false,
        createdAt: monday("09:00"),
        firstRespondedAt: monday("11:00"),
      },
      {
        breachedResolution: false,
        breachedResponse: false,
        createdAt: monday("09:00"),
        firstRespondedAt: null,
      },
      {
        breachedResolution: false,
        breachedResponse: true,
        createdAt: monday("09:00"),
        firstRespondedAt: null,
      },
    ],
    calendar
  );
  expect(insight).toEqual({
    // (60 + 120) / 2 business minutes.
    averageFirstResponseMinutes: 90,
    // One reopened of four handed over (two confirmed, one unconfirmed, one reopened).
    reopenRate: 0.25,
    slaBreachRate: 0.5,
    thumbsUpRate: 0.5,
  });
  expect(companyInsight([], [], calendar)).toEqual({
    averageFirstResponseMinutes: null,
    reopenRate: null,
    slaBreachRate: null,
    thumbsUpRate: null,
  });
});

it("gives admins the insight on the company page", async () => {
  const company = await callAs("admin", clientQueries.getClientCompany, {
    companyId: ids.clientCompanyId,
  });
  expect(company).toMatchObject({
    data: {
      insight: {
        averageFirstResponseMinutes: null,
        reopenRate: null,
        slaBreachRate: null,
        thumbsUpRate: null,
      },
    },
    ok: true,
  });
});
