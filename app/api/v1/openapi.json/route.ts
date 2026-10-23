import { buildOpenApiDocument } from "@/src/server/api/contract";

// The document is built from code, so it is the same for every request.
export const GET = (): Response => Response.json(buildOpenApiDocument());
