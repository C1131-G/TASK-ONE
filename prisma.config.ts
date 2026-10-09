import "dotenv/config";
import { readdirSync } from "node:fs";
import path from "node:path";

import { definePrismaConfig } from "@prisma/cli-engine";
import { prismaContract } from "@prisma/orm-family-sql/contract-psl/provider";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";
import {
  PG_INT_CODEC_ID,
  PG_TEXT_CODEC_ID,
} from "@prisma/orm-postgres/target/codec-ids";
import postgresPackRef from "@prisma/orm-postgres/target/pack";
import { postgresCreateNamespace } from "@prisma/orm-postgres/target/types";

const schemaGlob = "./src/prisma/**/*.prisma";

const schemaFilesIn = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return schemaFilesIn(filePath);
    }
    return entry.isFile() && entry.name.endsWith(".prisma") ? [filePath] : [];
  });

const pslContract = prismaContract(schemaGlob, {
  createNamespace: postgresCreateNamespace,
  enumInferenceCodecs: {
    int: PG_INT_CODEC_ID,
    text: PG_TEXT_CODEC_ID,
  },
  target: postgresPackRef,
});

// Prisma 8 rc.16 resolves glob paths to Windows backslashes before passing
// them to tinyglobby, which then finds no files. Expand this same schema glob
// to explicit file paths on Windows; other platforms use Prisma's native glob.
const contract =
  process.platform === "win32"
    ? {
        ...pslContract,
        source: {
          ...pslContract.source,
          inputs: schemaFilesIn("./src/prisma"),
        },
      }
    : pslContract;

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be configured for Prisma migrations.");
}

export default definePrismaConfig({
  orm: ormConfig({
    contract,
    db: {
      connection: databaseUrl,
    },
    migrations: { dir: "./migrations" },
  }),
});
