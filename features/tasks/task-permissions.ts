// Matches the server rule for editing a task: admins, the creator and any assignee.
export const canEditTaskRecord = (
  task: {
    readonly assigneeIds: readonly string[];
    readonly createdById: string;
  },
  currentUserId: string | null,
  isAdmin: boolean
): boolean =>
  isAdmin ||
  task.createdById === currentUserId ||
  (currentUserId !== null && task.assigneeIds.includes(currentUserId));
