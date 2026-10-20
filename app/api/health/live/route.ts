import { connection } from "next/server";

// Liveness: the process is up and serving requests. It checks no dependency,
// so a database or storage outage never makes an orchestrator restart it.
export const GET = async (): Promise<Response> => {
  // Answer from the running process, never from a build-time prerender.
  await connection();
  return Response.json(
    { status: "ok" },
    { headers: { "cache-control": "no-store" } }
  );
};
