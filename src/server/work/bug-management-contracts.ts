import { Schema } from "effect";

import { UUIDSchema } from "../core/input-schemas";
import type { BugReportInput } from "./bug-contracts";
import {
  BugDiscoverySourceSchema,
  BugEnvironmentSchema,
  BugSeveritySchema,
  ClientImpactSchema,
  BugWorkflowStatusSchema,
} from "./bug-contracts";

export const BugReportItemSchema = Schema.Struct({
  actualBehavior: Schema.String,
  appVersion: Schema.NullOr(Schema.String),
  browser: Schema.NullOr(Schema.String),
  clientCompanyId: Schema.NullOr(UUIDSchema),
  clientImpact: Schema.NullOr(ClientImpactSchema),
  component: Schema.String,
  description: Schema.NullOr(Schema.String),
  device: Schema.NullOr(Schema.String),
  discoveredAt: Schema.String,
  discoverySource: BugDiscoverySourceSchema,
  environment: BugEnvironmentSchema,
  expectedBehavior: Schema.String,
  id: UUIDSchema,
  os: Schema.NullOr(Schema.String),
  projectId: UUIDSchema,
  projectKey: Schema.String,
  projectTaskNumber: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0)
  ),
  reporterId: UUIDSchema,
  reproductionSteps: Schema.Array(Schema.String),
  route: Schema.String,
  severity: BugSeveritySchema,
  status: BugWorkflowStatusSchema,
  taskId: UUIDSchema,
  title: Schema.String,
  version: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
});

export type BugReportItem = typeof BugReportItemSchema.Type;

export const BugListItemSchema = Schema.Struct({
  archived: Schema.Boolean,
  assigneeIds: Schema.Array(UUIDSchema),
  bug: BugReportItemSchema,
  latestFixOutcome: Schema.NullOr(Schema.Literals(["passed", "failed"])),
  latestFixSummary: Schema.NullOr(Schema.String),
  priority: Schema.Literals(["urgent", "high", "medium", "low", "none"]),
  projectName: Schema.String,
  relatedBugIds: Schema.Array(UUIDSchema),
});

export const BugListSchema = Schema.Array(BugListItemSchema);

export const toBugReportItem = (
  bug: {
    readonly actualBehavior: string;
    readonly appVersion: string | null;
    readonly browser: string | null;
    readonly clientCompanyId: string | null;
    readonly clientImpact: typeof ClientImpactSchema.Type | null;
    readonly component: string;
    readonly description: string | null;
    readonly device: string | null;
    readonly discoveredAt: Date;
    readonly discoverySource: BugReportInput["discoverySource"];
    readonly environment: BugReportInput["environment"];
    readonly expectedBehavior: string;
    readonly id: string;
    readonly os: string | null;
    readonly projectId: string;
    readonly reproductionSteps: readonly string[];
    readonly reporterId: string;
    readonly route: string;
    readonly severity: BugReportInput["severity"];
    readonly status: typeof BugWorkflowStatusSchema.Type;
    readonly taskId: string;
    readonly title: string;
    readonly version: number;
  },
  projectKey: string,
  projectTaskNumber: number
): BugReportItem =>
  Schema.decodeUnknownSync(Schema.toType(BugReportItemSchema))({
    ...bug,
    discoveredAt: bug.discoveredAt.toISOString(),
    projectKey,
    projectTaskNumber,
  });
