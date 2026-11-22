/**
 * Only the Android habit editor can opt a NEW habit into a reminder when the
 * user manually chooses a scheduled time. Template-supplied times, existing
 * habit edits and a deliberate OFF selection never opt in automatically.
 * Permission checks occur only when the user explicitly enables a switch or
 * submits the form, not while typing a time.
 */
export function alarmForSelectedTime({
  isNewHabit,
  android,
  time,
  current,
  userToggledAlarm,
}: {
  isNewHabit: boolean;
  android: boolean;
  time: string;
  current: boolean;
  userToggledAlarm: boolean;
}): boolean {
  if (!time) return false;
  if (android && isNewHabit && !userToggledAlarm) return true;
  return current;
}
