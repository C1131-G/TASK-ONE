import "dotenv/config";
import { Effect } from "effect";

import {
  UserManagement,
  UserManagementLive,
} from "../src/server/people/user-management";

const name = process.env["BOOTSTRAP_ADMIN_NAME"]?.trim();
const email = process.env["BOOTSTRAP_ADMIN_EMAIL"]?.trim();

if (!name || !email) {
  throw new Error(
    "Set BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_EMAIL before bootstrapping."
  );
}

const created = await Effect.runPromise(
  Effect.gen(function* bootstrap() {
    const management = yield* UserManagement;
    return yield* management.createFirstAdmin({ email, name });
  }).pipe(Effect.provide(UserManagementLive))
);

process.stdout.write(
  `Created ${created.employeeId} (${created.email}).\nTemporary password: ${created.temporaryPassword}\nChange it at first sign-in.\n`
);
