import type { TimeGroup } from "./domain";

/** Routine groups are 05:00–10:59 / 11:00–16:59 / 17:00–04:59. */
export function scheduledTimeGroup(value: string | undefined): TimeGroup | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const hour = Number(value.slice(0, 2));
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  return "night";
}

const defaults: Readonly<Record<TimeGroup, string>> = {
  morning: "08:00", day: "13:00", night: "21:00",
};

/**
 * Keep an unset optional time unset. If a user changes the group while a
 * time is already selected, move that time into the chosen group's range.
 */
export function timeForSelectedGroup(value: string | undefined, group: TimeGroup): string | undefined {
  if (!value) return value;
  return scheduledTimeGroup(value) === group ? value : defaults[group];
}

/** A template must not silently override a time the user already selected. */
export function templateGroupForTime(
  value: string | undefined,
  templateGroup: TimeGroup,
  userEditedTime: boolean,
): TimeGroup {
  return userEditedTime ? (scheduledTimeGroup(value) ?? templateGroup) : templateGroup;
}
