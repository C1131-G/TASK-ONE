import { connection } from "next/server";

import { openRealtimeResponse } from "@/src/server/realtime/service";

// A long-lived Server-Sent Events stream: never prerendered or cached.
// eslint-disable-next-line func-style -- Next route handler remains a named export.
export async function GET(request: Request): Promise<Response> {
  await connection();
  return openRealtimeResponse(request);
}
