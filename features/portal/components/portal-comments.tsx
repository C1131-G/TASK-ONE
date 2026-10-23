"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { PortalTime } from "@/features/portal/components/portal-time";
import { addClientCommentAction } from "@/features/portal/portal-bug-actions";
import { LONG_TEXT_MAX_LENGTH } from "@/src/server/core/text-limits";
import type { PortalComment } from "@/src/server/portal/portal-contracts";

const BODY_MAX = LONG_TEXT_MAX_LENGTH;

const PortalComments = ({
  bugId,
  canComment,
  comments,
}: {
  readonly bugId: string;
  readonly canComment: boolean;
  readonly comments: readonly PortalComment[];
}) => {
  const [added, setAdded] = useState<readonly PortalComment[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const keyRef = useRef<string | null>(null);

  // A comment just posted shows at once; once the refreshed page includes it,
  // the server copy replaces the local one.
  const known = new Set(comments.map(({ id }) => id));
  const all = [...comments, ...added.filter(({ id }) => !known.has(id))];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setError("Write a message before sending.");
      return;
    }
    setPending(true);
    setError("");
    if (!keyRef.current) {
      keyRef.current = crypto.randomUUID();
    }
    try {
      const result = await addClientCommentAction({
        body: text,
        bugId,
        idempotencyKey: keyRef.current,
      });
      if (result.ok) {
        setAdded((current) => [...current, result.data]);
        setBody("");
        keyRef.current = null;
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("Your comment could not be sent. Try again.");
    }
    setPending(false);
  };

  return (
    <section aria-labelledby="portal-comments-h" className="panel portal-panel">
      <h2 className="sec" id="portal-comments-h">
        Comments
      </h2>
      {all.length > 0 ? (
        <ol className="portal-comments">
          {all.map((comment) => (
            <li
              className="portal-comment"
              data-team={comment.isTeam || undefined}
              key={comment.id}
            >
              <p className="portal-comment-head">
                <strong>{comment.isMine ? "You" : comment.authorName}</strong>
                {comment.isTeam ? (
                  <span className="badge accent">Support team</span>
                ) : null}
                <span className="faint">
                  <PortalTime iso={comment.createdAt} />
                </span>
              </p>
              <p className="portal-comment-body">{comment.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No comments yet.</p>
      )}
      {canComment ? (
        <form className="portal-composer" noValidate onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="portal-comment-body">
              Add a comment
            </label>
            <textarea
              aria-describedby={error ? "portal-comment-error" : undefined}
              aria-invalid={error ? true : undefined}
              className="textarea"
              disabled={pending}
              id="portal-comment-body"
              maxLength={BODY_MAX}
              onChange={(event) => {
                keyRef.current = null;
                setBody(event.target.value);
                setError("");
              }}
              rows={3}
              value={body}
            />
            {error ? (
              <p className="err" id="portal-comment-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div>
            <button
              className="btn btn-primary btn-sm"
              disabled={pending}
              type="submit"
            >
              {pending ? "Sending…" : "Send comment"}
            </button>
          </div>
        </form>
      ) : (
        <p className="hint">Comments are closed on this bug.</p>
      )}
    </section>
  );
};

export { PortalComments };
