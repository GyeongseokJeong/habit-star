import type { DailyRecordPatch, HabitSettingsPatch } from "./domain";

/** Compare persisted fields, not UI-only expansion or permission-in-flight state. */
export function hasUnsavedHabitSettings(
  initial: HabitSettingsPatch,
  draft: HabitSettingsPatch,
): boolean {
  const days = (value: number[] | undefined) => [...(value ?? [])].sort((a, b) => a - b).join(",");
  return initial.title !== draft.title ||
    initial.icon !== draft.icon ||
    initial.timeGroup !== draft.timeGroup ||
    (initial.scheduledTime ?? "") !== (draft.scheduledTime ?? "") ||
    Boolean(initial.alarmEnabled) !== Boolean(draft.alarmEnabled) ||
    days(initial.repeatDays) !== days(draft.repeatDays);
}

export function hasUnsavedDailyRecord(
  initial: DailyRecordPatch,
  draft: DailyRecordPatch,
): boolean {
  return initial.rating !== draft.rating ||
    initial.completed !== draft.completed ||
    initial.memo !== draft.memo;
}
