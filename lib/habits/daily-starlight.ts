import { isScheduled, type Habit } from "./domain";

/** Calendar intensity uses only the habits scheduled in that day's snapshot. */
export function dailyStarlight(habits: Habit[] | undefined, day: string) {
  const scheduled = (habits ?? []).filter((habit) => isScheduled(habit, day));
  const scheduledCount = scheduled.length;
  const earnedStars = scheduled.reduce((sum, habit) => sum + habit.rating, 0);
  const completedCount = scheduled.filter((habit) => habit.completed).length;
  return {
    state: habits === undefined ? "unrecorded" : scheduledCount === 0 ? "rest" : "scheduled",
    scheduledCount,
    completedCount,
    percent: scheduledCount ? (earnedStars / (5 * scheduledCount)) * 100 : 0,
    tier: scheduledCount ? Math.ceil(earnedStars / scheduledCount) : 0,
  } as const;
}
