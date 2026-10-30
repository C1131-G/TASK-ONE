import { connection } from "next/server";

import {
  unsubscribe,
  unsubscribePage,
} from "@/src/server/email/unsubscribe-http";

// Public on purpose: the signed token in the link proves who it was sent to.
export const GET = async (request: Request): Promise<Response> => {
  await connection();
  return unsubscribePage(request);
};

export const POST = async (request: Request): Promise<Response> => {
  await connection();
  return unsubscribe(request);
};
