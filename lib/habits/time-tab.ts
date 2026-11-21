import type { TimeGroup } from "./domain";

/** The user's configured time zone takes priority over the device time zone. */
export function currentTimeGroup(now: Date, timezone?: string): TimeGroup {
  const hour = timezone
    ? Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          hour: "2-digit",
          hourCycle: "h23",
        }).format(now),
      )
    : now.getHours();

  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  return "night";
}

/** Prefer a useful list on launch; never strand the user in an empty time tab. */
export function initialRoutineTab(
  now: Date,
  scheduledHabits: ReadonlyArray<{ timeGroup: TimeGroup }>,
  timezone?: string,
): "all" | TimeGroup {
  const current = currentTimeGroup(now, timezone);
  return scheduledHabits.some((habit) => habit.timeGroup === current)
    ? current
    : "all";
}

/** A cloud pull can complete before today's recurring entries are materialized. */
export function startupDataReady(
  member: boolean,
  snapshot: { day: string; history: Record<string, unknown>; state: { hydrated?: boolean } },
): boolean {
  return !member || (
    snapshot.state.hydrated === true &&
    Object.prototype.hasOwnProperty.call(snapshot.history, snapshot.day)
  );
}

/**
 * Show only pending habits from time groups that have already ended today.
 * Night spans midnight: from 00:00–04:59, today's morning/day are still ahead.
 * Callers pass today's scheduled habits only; no stored records are changed.
 */
export function countEarlierPendingHabits<T extends { timeGroup: TimeGroup; completed: boolean }>(
  tab: "all" | TimeGroup | "matrix",
  scheduledHabits: ReadonlyArray<T>,
  localHour: number,
  isCompleted: (habit: T) => boolean = (habit) => habit.completed,
): number {
  if (!Number.isInteger(localHour) || localHour < 0 || localHour > 23) return 0;
  const includeMorning = (tab === "day" || tab === "night") && localHour >= 11;
  const includeDay = tab === "night" && localHour >= 17;
  if (!includeMorning && !includeDay) return 0;

  return scheduledHabits.filter((habit) =>
    ((includeMorning && habit.timeGroup === "morning") ||
      (includeDay && habit.timeGroup === "day")) &&
    !isCompleted(habit)
  ).length;
}
