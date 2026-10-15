// Mirrors AUDIT_EVENT_TYPES in src/server/audit/audit-log.ts. That module
// imports the database, so client code keeps its own copy with labels.
export const auditEventLabels = {
  account_locked: "Account locked",
  account_unlocked: "Account unlocked",
  company_deactivated: "Company deactivated",
  company_reactivated: "Company reactivated",
  login_blocked: "Sign-in blocked",
  login_failed: "Sign-in failed",
  login_succeeded: "Signed in",
  password_changed: "Password changed",
  password_reset: "Password reset",
  preview_ended: "Portal preview ended",
  preview_started: "Portal preview started",
  user_deactivated: "User deactivated",
  user_reactivated: "User reactivated",
} as const;

export type AuditEventType = keyof typeof auditEventLabels;

export const auditEventTypes = Object.keys(
  auditEventLabels
) as AuditEventType[];

export const isAuditEventType = (value: string): value is AuditEventType =>
  Object.hasOwn(auditEventLabels, value);

export const auditEventLabel = (type: string): string =>
  isAuditEventType(type) ? auditEventLabels[type] : type.replaceAll("_", " ");
