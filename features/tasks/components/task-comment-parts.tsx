/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { LocalTime } from "@/components/workspace/local-time";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { CommentVisibility } from "@/src/server/collaboration/contracts";

import { mentionSegments } from "../task-mentions";

export interface TaskCommentView {
  readonly id: string;
  readonly taskId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
  readonly visibility?: CommentVisibility;
  readonly reactions: readonly {
    readonly emoji: string;
    readonly count: number;
    readonly reacted: boolean;
  }[];
}

// The @ picker is an ARIA combobox list, which has no native element.
const CommentBody = ({
  body,
  names,
}: {
  readonly body: string;
  readonly names: ReadonlyMap<string, string>;
}) => (
  <p>
    {mentionSegments(body, names).map((segment, index) =>
      segment.kind === "text" ? (
        <span key={index}>{segment.text}</span>
      ) : (
        <span className="mention" key={index}>
          @{segment.name}
        </span>
      )
    )}
  </p>
);

export const CommentCard = ({
  canRemove,
  comment,
  names,
  onReact,
  onRemove,
  pending,
}: {
  readonly canRemove: boolean;
  readonly comment: TaskCommentView;
  readonly names: ReadonlyMap<string, string>;
  readonly onReact: (comment: TaskCommentView, emoji: string) => void;
  readonly onRemove: (commentId: string) => void;
  readonly pending: boolean;
}) => (
  <article className="panel panel-b comment">
    <div className="row">
      <strong>{comment.authorName}</strong>
      {comment.visibility === "public" ? (
        <span className="badge accent">Public</span>
      ) : null}
      <LocalTime
        className="muted"
        format="relative"
        value={comment.createdAt}
      />
      <span className="sp" />
      {canRemove ? (
        <WorkspaceButton
          className="ibtn ibtn-sm"
          disabled={pending}
          onClick={() => onRemove(comment.id)}
          type="button"
        >
          Remove
        </WorkspaceButton>
      ) : null}
    </div>
    <CommentBody body={comment.body} names={names} />
    <div className="row">
      {comment.reactions.map((reaction) => (
        <WorkspaceButton
          aria-pressed={reaction.reacted}
          className="btn btn-sm btn-ghost"
          disabled={pending}
          key={reaction.emoji}
          onClick={() => onReact(comment, reaction.emoji)}
          type="button"
        >
          {reaction.emoji} {reaction.count}
        </WorkspaceButton>
      ))}
      {["👍", "❤️", "🎉"].map((emoji) => (
        <WorkspaceButton
          aria-label={`React ${emoji}`}
          className="ibtn ibtn-sm"
          disabled={pending}
          key={`add-${emoji}`}
          onClick={() => onReact(comment, emoji)}
          type="button"
        >
          {emoji}
        </WorkspaceButton>
      ))}
    </div>
  </article>
);

export const VisibilityToggle = ({
  fieldId,
  helperId,
  onVisibilityChange,
  visibility,
}: {
  readonly fieldId: string;
  readonly helperId: string;
  readonly onVisibilityChange: (visibility: CommentVisibility) => void;
  readonly visibility: CommentVisibility;
}) => (
  <div className="comment-visibility">
    <div
      aria-describedby={helperId}
      aria-label="Comment visibility"
      className="comment-visibility-options"
      role="radiogroup"
    >
      {(
        [
          ["internal", "Internal note"],
          ["public", "Public reply"],
        ] as const
      ).map(([value, label]) => (
        <label
          className="comment-visibility-option"
          data-checked={visibility === value}
          key={value}
        >
          <input
            checked={visibility === value}
            name={`${fieldId}-visibility`}
            onChange={() => onVisibilityChange(value)}
            type="radio"
            value={value}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
    <p className="muted" id={helperId}>
      {visibility === "public"
        ? "Visible to the client and their colleagues"
        : "Only your team sees this"}
    </p>
  </div>
);
