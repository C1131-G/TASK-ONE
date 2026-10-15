// Where the admin's saved browser state lives. The file is git-ignored.
export const ADMIN_STATE = "tests/e2e/.auth/admin.json";

// The employee's saved state, written only when E2E_EMPLOYEE_PASSWORD is set.
export const EMPLOYEE_STATE = "tests/e2e/.auth/employee.json";

// Saved states for the client portal specs, written when E2E_PORTAL_PASSWORD is set.
export const CLIENT_ONE_STATE = "tests/e2e/.auth/client-one.json";
export const CLIENT_TWO_STATE = "tests/e2e/.auth/client-two.json";
export const HANDLER_STATE = "tests/e2e/.auth/handler.json";

// Accounts created by scripts/seed-e2e-accounts.ts.
export const PORTAL_ACCOUNTS = {
  clientOne: "client-one@acme.test",
  clientTwo: "client-two@acme.test",
  handler: "handler-one@metsys.test",
  lockoutClient: "lockout-client@acme.test",
} as const;
