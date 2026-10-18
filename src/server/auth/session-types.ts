export type UserRole = "admin" | "employee" | "client";

export interface AuthenticatedUser {
  readonly id: string;
  readonly role: UserRole;
  readonly clientCompanyId: string | null;
  readonly employeeNumber: number;
  readonly mustChangePassword: boolean;
  readonly name: string;
  readonly timeZone: string | null;
}

export type WorkspaceUser = AuthenticatedUser & {
  readonly role: "admin" | "employee";
};

export interface PortalUser extends AuthenticatedUser {
  readonly clientCompanyId: string;
  readonly clientCompanyName: string;
  // Set when an admin is looking at the portal as this client. A preview is
  // read-only: only requirePortalView accepts it.
  readonly preview: {
    readonly adminId: string;
    readonly adminName: string;
  } | null;
}
