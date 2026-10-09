import { toNextJsHandler } from "better-auth/next-js";

import { db } from "@/src/prisma/db";
import { auth } from "@/src/server/auth/auth";

const handlers = toNextJsHandler(auth);
const allowedPaths = new Set(["/sign-in/email", "/sign-out", "/get-session"]);

const handleAuthRequest = async (
  request: Request,
  handler: (request: Request) => Promise<Response>
): Promise<Response> => {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/u, "");
  if (!allowedPaths.has(path)) {
    return new Response(null, { status: 404 });
  }

  if (path !== "/sign-in/email") {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return path === "/get-session"
        ? handler(request)
        : Response.json({ message: "Sign in to continue." }, { status: 401 });
    }
    const user = await db.orm.public.User.where({ id: session.user.id })
      .select("deactivatedAt", "mustChangePassword")
      .first();
    if ((!user || user.deactivatedAt) && path !== "/sign-out") {
      return Response.json(
        { message: "This account is unavailable." },
        { status: 401 }
      );
    }
    if (
      user?.mustChangePassword &&
      path !== "/sign-out" &&
      path !== "/get-session"
    ) {
      return Response.json(
        { message: "Change your password before continuing." },
        { status: 403 }
      );
    }
  }

  return handler(request);
};

export const GET = (request: Request): Promise<Response> =>
  handleAuthRequest(request, handlers.GET);

export const POST = (request: Request): Promise<Response> =>
  handleAuthRequest(request, handlers.POST);
