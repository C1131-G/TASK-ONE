import "dotenv/config";
import { AsyncLocalStorage } from "node:async_hooks";

import postgres from "@prisma/orm-postgres/runtime";

import { authPool } from "../server/auth/database";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be configured before opening the database."
  );
}

const client = postgres<Contract>({
  contractJson,
  pg: authPool as unknown as NonNullable<
    NonNullable<Parameters<typeof postgres<Contract>>[0]>["pg"]
  >,
});

type TransactionContext = Parameters<
  Parameters<typeof client.transaction>[0]
>[0];

const transactionContext = new AsyncLocalStorage<TransactionContext>();

export const db = new Proxy(client, {
  get(target, property, receiver) {
    const activeTransaction = transactionContext.getStore();
    if (property === "orm" && activeTransaction) {
      return activeTransaction.orm;
    }
    if (property === "transaction") {
      // eslint-disable-next-line promise/prefer-await-to-callbacks -- Prisma exposes transactions as a callback API.
      return <Result>(
        operation: (transaction: TransactionContext) => Promise<Result>
      ): Promise<Result> => {
        if (activeTransaction) {
          return operation(activeTransaction);
        }
        // eslint-disable-next-line promise/prefer-await-to-callbacks -- Prisma requires a transaction callback.
        return target.transaction((transaction) =>
          transactionContext.run(transaction, () => operation(transaction))
        );
      };
    }
    return Reflect.get(target, property, receiver) as unknown;
  },
});
