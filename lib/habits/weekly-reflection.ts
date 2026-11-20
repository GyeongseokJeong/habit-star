import { isScheduled, validDay, type Habit } from "./domain";
import { isUnconfirmedDemoCompletion } from "../constellation/growth";
import type { Snapshot } from "./repository";

export type ReflectionStatus = "restart" | "steady" | "quiet" | "insufficient";

export type HabitReflection = {
  id: string;
  title: string;
  icon: string;
  observedDays: number;
  /** 28 days for one/two-day weekly routines, 7 days for other routines. */
  analysisDays: 7 | 28;
  completedDays: number;
  missedDays: number;
  lastCompletedDay: string | null;
  todayScheduled: boolean;
  todayCompleted: boolean;
  nextScheduledDay: string | null;
};

export type WeeklyReflection = {
  startDay: string;
  endDay: string;
  status: ReflectionStatus;
  recommendations: HabitReflection[];
  encouragingHabit: HabitReflection | null;
};

/** Calendar-day arithmetic on YYYY-MM-DD keys, independent of DST and device timezone. */
export function shiftDay(day: string, delta: number): string {
  if (!validDay(day)) throw Error("invalid_day");
  return new Date(Date.parse(`${day}T12:00:00Z`) + delta * 86_400_000)
    .toISOString().slice(0, 10);
}

export function nextScheduledDay(habit: Habit, today: string): string | null {
  if (!validDay(today)) return null;
  for (let offset = 1; offset <= 7; offset++) {
    const day = shiftDay(today, offset);
    if (isScheduled(habit, day)) return day;
  }
  return null;
}

function compareRecommendations(a: HabitReflection, b: HabitReflection) {
  return (
    b.missedDays - a.missedDays ||
    a.completedDays / a.observedDays - b.completedDays / b.observedDays ||
    (a.lastCompletedDay ?? "").localeCompare(b.lastCompletedDay ?? "") ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Read-only snapshot projection. A missing date/day entry is UNKNOWN, never
 * counted as a missed practice. Use historical, not current, repeat rules.
 * Today's snapshot is excluded. Weekday routines use the previous seven
 * calendar days; one/two-day weekly routines need up to 28 calendar days
 * for three observed scheduled days. Missing history is always unknown.
 */
export function calculateWeeklyReflection(
  snapshot: Pick<Snapshot, "day" | "habits" | "history" | "state">,
): WeeklyReflection {
  const empty: WeeklyReflection = {
    startDay: "", endDay: "", status: "insufficient",
    recommendations: [], encouragingHabit: null,
  };
  if (!validDay(snapshot.day)) return empty;

  const startDay = shiftDay(snapshot.day, -7);
  const endDay = shiftDay(snapshot.day, -1);
  const days = Array.from({ length: 28 }, (_, index) => shiftDay(snapshot.day, index - 28));
  const active = new Map(snapshot.habits.map((habit) => [habit.id, habit]));
  const progress: HabitReflection[] = [];

  for (const habit of active.values()) {
    // A weekly/twice-weekly habit cannot reach 3 observed days in a week.
    // Broaden ONLY that habit's evidence window; preserve the original
    // last-7-days rule for every other schedule and the screen header.
    const analysisDays: 7 | 28 =
      habit.repeatDays !== undefined && habit.repeatDays.length <= 2 ? 28 : 7;
    const eligibleDays = days.slice(28 - analysisDays);
    let observedDays = 0;
    let completedDays = 0;
    let lastCompletedDay: string | null = null;

    for (const day of eligibleDays) {
      // History only contains dates actually materialized in this scope.
      const historical = snapshot.history[day]?.find((entry) => entry.id === habit.id);
      if (!historical || !isScheduled(historical, day)) continue;

      // A pre-filled guest demo is not a real observation or an achievement.
      if (isUnconfirmedDemoCompletion(snapshot.state, day, historical)) continue;

      observedDays++;
      if (historical.completed) {
        completedDays++;
        lastCompletedDay = day;
      }
    }

    if (observedDays === 0) continue;
    progress.push({
      id: habit.id,
      title: habit.title,
      icon: habit.icon,
      observedDays,
      analysisDays,
      completedDays,
      missedDays: observedDays - completedDays,
      lastCompletedDay,
      todayScheduled: isScheduled(habit, snapshot.day),
      todayCompleted: habit.completed,
      nextScheduledDay: nextScheduledDay(habit, snapshot.day),
    });
  }

  // Initial product thresholds, not a clinical or statistical inference.
  const eligible = progress.filter((item) =>
    item.observedDays >= 3 &&
    item.missedDays >= 2 &&
    item.completedDays / item.observedDays <= 0.4,
  );
  const recommendations = eligible.sort(compareRecommendations).slice(0, 2);
  const encouragingHabit = progress
    .filter((item) =>
      item.observedDays >= 3 &&
      item.completedDays >= 3 &&
      item.completedDays / item.observedDays >= 0.8,
    )
    .sort((a, b) =>
      b.completedDays / b.observedDays - a.completedDays / a.observedDays ||
      b.completedDays - a.completedDays ||
      a.id.localeCompare(b.id),
    )[0] ?? null;

  const hasEnoughData = progress.some((item) => item.observedDays >= 3);
  const status: ReflectionStatus = !hasEnoughData
    ? "insufficient"
    : recommendations.length
      ? "restart"
      : encouragingHabit
        ? "steady"
        : "quiet";

  return { startDay, endDay, status, recommendations, encouragingHabit };
}

export type TodayRecoverySummary = {
  /** The historical top two never change solely because today's status changes. */
  ordered: HabitReflection[];
  completedToday: number;
  allCompletedToday: boolean;
};

/**
 * Presentation-only order for an already selected historical recommendation.
 * Today's available actions first, next opportunities second, today's successes
 * last. Do not change yesterday's counts, thresholds or selected habit IDs.
 */
export function summarizeTodayRecovery(
  recommendations: readonly HabitReflection[],
): TodayRecoverySummary {
  const ordered = recommendations
    .map((item, index) => ({
      item,
      index,
      priority: item.todayCompleted ? 2 : item.todayScheduled ? 0 : 1,
    }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ item }) => item);
  const completedToday = recommendations.filter((item) => item.todayCompleted).length;
  return {
    ordered,
    completedToday,
    allCompletedToday: recommendations.length > 0 &&
      completedToday === recommendations.length,
  };
}
