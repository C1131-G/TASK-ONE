import { Effect } from "effect";

import { db } from "../src/prisma/db";
export const isoDate = (offsetDays: number) => {
  const date = new Date(Date.UTC(2026, 9, 12 + offsetDays));
  return date.toISOString().slice(0, 10);
};

export const findProjectId = (key: string) =>
  Effect.promise(async () => {
    const project = await db.orm.public.Project.where({ key })
      .select("id")
      .first();
    return project?.id ?? null;
  });
