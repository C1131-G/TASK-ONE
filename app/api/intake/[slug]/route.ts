import { resolveClientIp } from "@/src/server/core/client-ip";
import { MAX_ATTACHMENT_BYTES } from "@/src/server/intake/intake-config";
import {
  appErrorResponse,
  failureResponse,
  json,
  readBoundedBytes,
  runIntake,
} from "@/src/server/intake/intake-http";

// The public form posts here without a session. Everything it sends is
// untrusted: the body is size-bounded before it is parsed and every field is
// validated again by the intake service.
const FORM_OVERHEAD_BYTES = 64 * 1024;
const MAX_BODY_BYTES = MAX_ATTACHMENT_BYTES + FORM_OVERHEAD_BYTES;

const textField = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const attachmentField = async (form: FormData) => {
  const value = form.get("attachment");
  if (typeof value === "string" || value === null) {
    return null;
  }
  // Browsers send an empty, unnamed file when nothing was chosen.
  if (value.size === 0 && !value.name) {
    return null;
  }
  return {
    bytes: new Uint8Array(await value.arrayBuffer()),
    contentType: value.type,
    fileName: value.name,
  };
};

// eslint-disable-next-line func-style -- Next route handler remains a named export.
export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly slug: string }> }
): Promise<Response> {
  const [{ slug }, bytes] = await Promise.all([
    context.params,
    readBoundedBytes(request, MAX_BODY_BYTES),
  ]);
  if (!bytes) {
    return failureResponse(413, "TOO_LARGE", "The submission is too large.");
  }
  let form: FormData;
  try {
    form = await new Response(bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return failureResponse(400, "BAD_REQUEST", "The form could not be read.");
  }
  const attachment = await attachmentField(form);
  const outcome = await runIntake((service) =>
    service.submitWeb({
      attachment,
      clientIp: resolveClientIp(request.headers),
      description: textField(form, "description"),
      email: textField(form, "email"),
      formToken: textField(form, "formToken"),
      slug,
      title: textField(form, "title"),
      website: textField(form, "website"),
    })
  );
  return outcome.ok
    ? json(201, outcome.value)
    : appErrorResponse(outcome.error);
}
