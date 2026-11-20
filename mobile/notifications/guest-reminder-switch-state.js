/**
 * STEP 18 follow-up: distinguish the user's saved preference from the state
 * of Android notification delivery. Revoking OS permission must not erase
 * recorded habits, pending native alarms or the user's previous opt-in.
 */
export function reminderSwitchChecked(optIn, permission) {
  return optIn === true && permission === "granted";
}

export function reminderSwitchNextAction(optIn, permission) {
  return !reminderSwitchChecked(optIn, permission);
}

export function canManuallyRepairGuestReminders(report, optIn, permission) {
  return optIn === true && permission === "granted" && report?.status === "out-of-sync";
}
