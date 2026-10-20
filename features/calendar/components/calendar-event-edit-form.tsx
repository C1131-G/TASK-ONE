/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import { WorkspaceDateTimePicker } from "@/components/workspace/workspace-date-time-picker";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import { useWorkspaceUndo } from "@/components/workspace/workspace-undo";
import {
  deleteCalendarEventAction,
  updateCalendarEventAction,
} from "@/features/calendar/calendar-actions";
import type { CalendarEventSummary } from "@/src/server/calendar/calendar-contracts";

const EVENT_FIELDS = [
  "title",
  "startsAt",
  "endsAt",
  "location",
  "description",
] as const;

// The picker edits the viewer's wall-clock time; it only renders once the
// disclosure opens on the client, so the browser's zone applies.
const toLocalInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const CalendarEventEditForm = ({
  event,
}: {
  readonly event: CalendarEventSummary;
}) => {
  const [pending, startTransition] = useTransition();
  // Which button started the pending request, so only that one says so.
  const [pendingAction, setPendingAction] = useState<"delete" | "save">("save");
  const { notifySaved } = useWorkspaceUndo();
  const {
    clearErrors,
    errors,
    fieldProps,
    formId: fieldId,
    formRef,
    showFailure,
    showFormError,
  } = useFormErrors(EVENT_FIELDS);

  const updateEvent = (formData: FormData) => {
    if (pending) {
      return;
    }
    const startsAt = String(formData.get("startsAt") ?? "");
    const endsAt = String(formData.get("endsAt") ?? "");
    if (!startsAt) {
      showFailure({
        fieldErrors: { startsAt: "Choose a start time." },
        message: "Choose a start time.",
      });
      return;
    }
    clearErrors();
    setPendingAction("save");
    startTransition(async () => {
      const result = await updateCalendarEventAction({
        attendeeIds: event.attendeeIds,
        description: String(formData.get("description") ?? "").trim() || null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        eventId: event.id,
        idempotencyKey: crypto.randomUUID(),
        location: String(formData.get("location") ?? "").trim() || null,
        projectId: event.projectId,
        startsAt: new Date(startsAt).toISOString(),
        title: String(formData.get("title") ?? "").trim(),
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      notifySaved("Event saved");
    });
  };

  const deleteEvent = () => {
    if (pending) {
      return;
    }
    setPendingAction("delete");
    startTransition(async () => {
      const result = await deleteCalendarEventAction({
        eventId: event.id,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        showFormError(result.error.message);
        return;
      }
      clearErrors();
    });
  };

  const saving = pending && pendingAction === "save";
  const deleting = pending && pendingAction === "delete";

  return (
    <form
      action={updateEvent}
      aria-busy={pending || undefined}
      className="panel-b stack"
      ref={formRef}
    >
      <div className="field">
        <label htmlFor={`${fieldId}-title`}>Title</label>
        <WorkspaceInput
          className="input"
          defaultValue={event.title}
          maxLength={160}
          name="title"
          required
          id={`${fieldId}-title`}
          {...fieldProps("title")}
        />
        <WorkspaceFieldError errors={errors} field="title" formId={fieldId} />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor={`${fieldId}-startsAt`}>Starts</label>
          <WorkspaceDateTimePicker
            ariaLabel={`Choose start date and time for ${event.title}`}
            className="input"
            id={`${fieldId}-startsAt`}
            name="startsAt"
            required
            defaultValue={toLocalInputValue(event.startsAt)}
            {...fieldProps("startsAt")}
          />
          <WorkspaceFieldError
            errors={errors}
            field="startsAt"
            formId={fieldId}
          />
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-endsAt`}>Ends</label>
          <WorkspaceDateTimePicker
            ariaLabel={`Choose end date and time for ${event.title}`}
            className="input"
            id={`${fieldId}-endsAt`}
            name="endsAt"
            defaultValue={event.endsAt ? toLocalInputValue(event.endsAt) : ""}
            {...fieldProps("endsAt")}
          />
          <WorkspaceFieldError
            errors={errors}
            field="endsAt"
            formId={fieldId}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${fieldId}-location`}>Location</label>
        <WorkspaceInput
          className="input"
          defaultValue={event.location ?? ""}
          maxLength={160}
          name="location"
          id={`${fieldId}-location`}
          {...fieldProps("location")}
        />
        <WorkspaceFieldError
          errors={errors}
          field="location"
          formId={fieldId}
        />
      </div>
      <div className="field">
        <label htmlFor={`${fieldId}-description`}>Description</label>
        <WorkspaceTextarea
          className="input"
          defaultValue={event.description ?? ""}
          maxLength={1000}
          name="description"
          rows={2}
          id={`${fieldId}-description`}
          {...fieldProps("description")}
        />
        <WorkspaceFieldError
          errors={errors}
          field="description"
          formId={fieldId}
        />
      </div>
      <WorkspaceFormError errors={errors} />
      <div className="acts">
        <WorkspaceButton
          aria-busy={saving || undefined}
          className="btn btn-primary btn-sm"
          disabled={pending}
          type="submit"
        >
          {saving ? "Saving…" : "Save event"}
        </WorkspaceButton>
        <WorkspaceConfirmDialog
          confirmLabel="Delete event"
          description={`Delete “${event.title}” from the workspace calendar?`}
          onConfirm={deleteEvent}
          title="Delete calendar event"
        >
          <WorkspaceButton
            aria-busy={deleting || undefined}
            className="btn btn-secondary btn-sm"
            disabled={pending}
            type="button"
          >
            {deleting ? "Deleting…" : "Delete"}
          </WorkspaceButton>
        </WorkspaceConfirmDialog>
      </div>
    </form>
  );
};

export { CalendarEventEditForm };
