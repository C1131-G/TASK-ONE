/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceTextarea } from "@/components/workspace/workspace-controls";
import type { CommentVisibility } from "@/src/server/collaboration/contracts";

import { findMentionQuery, insertMention } from "../task-mentions";
import { CommentCard, VisibilityToggle } from "./task-comment-parts";
import type { TaskCommentView } from "./task-comment-parts";

interface MentionEmployee {
  readonly id: string;
  readonly name: string;
}

const MAX_MENTION_OPTIONS = 6;

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
        <CommentCard
          canRemove={isAdmin || comment.authorId === currentUserId}
          comment={comment}
          key={comment.id}
          names={names}
          onReact={onReact}
          onRemove={onRemove}
          pending={pending}
        />
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
          <VisibilityToggle
            fieldId={fieldId}
            helperId={helperId}
            onVisibilityChange={onVisibilityChange}
            visibility={visibility}
          />
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
