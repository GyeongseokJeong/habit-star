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
