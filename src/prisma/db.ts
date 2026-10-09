import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";

import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be configured before opening the database."
  );
}

export const db = postgres<Contract>({
  contractJson,
  url: databaseUrl,
});
