/**
 * The longest free-text body a person can write: task descriptions, task
 * comments, bug comments and subtask descriptions all share it, so a note that
 * fits in one place can be pasted into another. Plain constants only, so forms
 * and server checks import the same number.
 */
export const LONG_TEXT_MAX_LENGTH = 20_000;
