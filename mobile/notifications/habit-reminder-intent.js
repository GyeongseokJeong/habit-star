/** Habit-level ON plus a valid time is explicit reminder consent.
 * OS permission is checked separately; never request it on app startup.
 */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export function hasConfiguredHabitReminders(snapshot) {
  return Array.isArray(snapshot?.habits) && snapshot.habits.some(habit =>
    habit?.alarmEnabled === true &&
    typeof habit.scheduledTime === "string" && TIME.test(habit.scheduledTime)
  );
}
export function effectiveHabitReminderOptIn(legacyDeviceOptIn, snapshot) {
  return legacyDeviceOptIn === true || hasConfiguredHabitReminders(snapshot);
}
