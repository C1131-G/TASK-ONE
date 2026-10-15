/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceTextarea } from "@/components/workspace/workspace-controls";
import type { CommentVisibility } from "@/src/server/collaboration/contracts";

import {
  findMentionQuery,
  insertMention,
  mentionSegments,
} from "../task-mentions";

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

interface MentionEmployee {
  readonly id: string;
  readonly name: string;
}

const MAX_MENTION_OPTIONS = 6;

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

export const TaskCommentsSection = ({
  body,
  comments,
  currentUserId,
  employees,
  isAdmin,
  allowPublicReplies = false,
  onBodyChange,
  onReact,
  onRemove,
  onSubmit,
  onVisibilityChange,
  pending,
  visibility = "internal",
}: {
  readonly allowPublicReplies?: boolean;
  readonly body: string;
  readonly comments: readonly TaskCommentView[];
  readonly currentUserId: string | null;
  readonly employees: readonly MentionEmployee[];
  readonly isAdmin: boolean;
  readonly onBodyChange: (value: string) => void;
  readonly onReact: (comment: TaskCommentView, emoji: string) => void;
  readonly onRemove: (commentId: string) => void;
  readonly onSubmit: () => void;
  readonly onVisibilityChange?: (visibility: CommentVisibility) => void;
  readonly pending: boolean;
  readonly visibility?: CommentVisibility;
}) => {
  const fieldId = useId();
  const listboxId = `${fieldId}-mentions`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{
    readonly query: string;
    readonly start: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const names = new Map(
    employees.map((employee) => [employee.id, employee.name])
  );
  const options =
    mention === null
      ? []
      : employees
          .filter((employee) =>
            employee.name
              .toLocaleLowerCase()
              .includes(mention.query.toLocaleLowerCase())
          )
          .slice(0, MAX_MENTION_OPTIONS);

  const updateMention = (value: string, caret: number) => {
    setMention(findMentionQuery(value, caret));
    setActiveIndex(0);
  };

  const chooseEmployee = (employee: MentionEmployee) => {
    const textarea = textareaRef.current;
    if (!mention || !textarea) {
      return;
    }
    const next = insertMention(
      body,
      mention.start,
      textarea.selectionStart,
      employee.id
    );
    onBodyChange(next.value);
    setMention(null);
    // The caret moves after React writes the new value into the textarea.
    window.setTimeout(() => {
      textarea.setSelectionRange(next.caret, next.caret);
      textarea.focus();
    }, 0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (options.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + options.length) % options.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      const option = options[activeIndex];
      if (option) {
        event.preventDefault();
        chooseEmployee(option);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMention(null);
    }
  };

  const listOpen = options.length > 0;
  const showToggle = allowPublicReplies && onVisibilityChange !== undefined;
  const helperId = `${fieldId}-visibility-help`;

  return (
    <section className="stack">
      <h3>Comments</h3>
      {comments.map((comment) => (
        <article className="panel panel-b comment" key={comment.id}>
          <div className="row">
            <strong>{comment.authorName}</strong>
            {comment.visibility === "public" ? (
              <span className="badge accent">Public</span>
            ) : null}
            <time className="muted" dateTime={comment.createdAt}>
              {comment.createdAt.slice(0, 10)}
            </time>
            <span className="sp" />
            {isAdmin || comment.authorId === currentUserId ? (
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
      ))}
      <div
        className={`field task-mention-field${
          showToggle && visibility === "public"
            ? " comment-composer-public"
            : ""
        }`}
      >
        <label htmlFor={fieldId}>
          <span>Add a comment</span>
        </label>
        <WorkspaceTextarea
          aria-autocomplete="list"
          aria-controls={listOpen ? listboxId : undefined}
          aria-expanded={listOpen}
          className="input"
          id={fieldId}
          maxLength={10_000}
          onChange={(event) => {
            onBodyChange(event.currentTarget.value);
            updateMention(
              event.currentTarget.value,
              event.currentTarget.selectionStart
            );
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type @ to mention someone"
          ref={textareaRef}
          value={body}
        />
        {showToggle ? (
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
        ) : null}
        {listOpen ? (
          // Focus stays in the textarea, which owns the keyboard handling, so
          // Command only renders the list and reports the pointer selection.
          <Command
            className="task-mention-list h-auto rounded-none bg-transparent p-0"
            label="Mention an employee"
            onValueChange={(value) => {
              const index = options.findIndex((option) => option.id === value);
              if (index !== -1) {
                setActiveIndex(index);
              }
            }}
            shouldFilter={false}
            value={options[activeIndex]?.id ?? ""}
          >
            <CommandList id={listboxId}>
              {options.map((option) => (
                <CommandItem
                  className="task-mention-option"
                  key={option.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onSelect={() => chooseEmployee(option)}
                  value={option.id}
                >
                  {option.name}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        ) : null}
      </div>
      <WorkspaceButton
        className="btn btn-sm btn-primary"
        disabled={pending || !body.trim()}
        onClick={onSubmit}
        type="button"
      >
        {showToggle && visibility === "public"
          ? "Post public reply"
          : "Comment"}
      </WorkspaceButton>
    </section>
  );
};
