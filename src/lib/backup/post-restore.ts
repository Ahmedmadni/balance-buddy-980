/**
 * Client-side completion steps following a successfully COMMITTED v2 restore.
 * Failure of Android plugins / view refetch MUST NOT cause a second destructive
 * restore attempt. Reminders from the previous snapshot are cancelled first.
 */
export interface PostRestoreActions {
  native: boolean;
  clearNativeReminders: () => Promise<void>;
  refreshActiveViews: () => Promise<void>;
  syncNativeReminders: () => Promise<void>;
}

export interface PostRestoreResult {
  viewUpdated: boolean;
  remindersCleared: boolean;
  remindersSynced: boolean;
}

export async function afterSuccessfulBackupRestore(
  steps: PostRestoreActions,
): Promise<PostRestoreResult> {
  let remindersCleared = !steps.native;
  let remindersSynced = !steps.native;
  let viewUpdated = false;

  if (steps.native) {
    try {
      // Never let old account-data reminders fire after restore.
      await steps.clearNativeReminders();
      remindersCleared = true;
    } catch {
      // Distinguish a committed restore from incomplete OS alarm cleanup.
    }
  }
  try {
    await steps.refreshActiveViews();
    viewUpdated = true;
  } catch {
    // The data is already committed. Never retry the RPC just for stale UI.
  }
  if (steps.native && remindersCleared) {
    try {
      // No implicit permission request; honors user's previous opt-in.
      await steps.syncNativeReminders();
      remindersSynced = true;
    } catch {
      // Next foreground tick may recover the schedule; report uncertainty.
    }
  }

  return { viewUpdated, remindersCleared, remindersSynced };
}
