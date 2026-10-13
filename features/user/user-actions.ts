"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { changeOwnPasswordAction as changeOwnPasswordImpl } from "./actions/password";
import {
  savePersonalPreferencesAction as savePersonalPreferencesImpl,
  saveTaskTableColumnWidthsAction as saveTaskTableColumnWidthsImpl,
} from "./actions/personal-preferences";
import { revokeSessionAction as revokeSessionImpl } from "./actions/sessions";

export async function changeOwnPasswordAction(input: unknown) {
  return await changeOwnPasswordImpl(input);
}

export async function revokeSessionAction(input: unknown) {
  return await revokeSessionImpl(input);
}

export async function savePersonalPreferencesAction(input: unknown) {
  return await savePersonalPreferencesImpl(input);
}

export async function saveTaskTableColumnWidthsAction(input: unknown) {
  return await saveTaskTableColumnWidthsImpl(input);
}
