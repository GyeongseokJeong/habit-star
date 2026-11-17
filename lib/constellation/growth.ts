import { validDay, type Habit, type History } from "../habits/domain";
import type { Snapshot, State } from "../habits/repository";

export type GrowthDay = { day: string; completedHabits: number; points: number };
export type ConstellationGrowth = {
  totalPoints: number;
  totalCompletedHabits: number;
  days: GrowthDay[];
};

/** Only the automatically seeded guest demo—not real legacy imported data. */
export function isFreshGuestDemo(state: Pick<State, "migration">): boolean {
  const raw = state.migration?.backup.raw;
  return !!raw && [
    "byeolharu_v1_habits", "byeolharu_v1_history", "byeolharu_v1_day",
  ].every((key) => raw[key] == null);
}

function isUnconfirmedDemoCompletion(state: State, day: string, habit: Habit): boolean {
  if (!isFreshGuestDemo(state)) return false;
  const baseline = state.migration?.entities.find(
    (entity) =>
      entity.kind === "habit_entries" && entity.day === day &&
      entity.id === habit.id && entity.data.completed === true &&
      !entity.deleted,
  );
  if (!baseline) return false;
  if (state.demoConfirmedDailyEntryKeys?.includes(baseline.key)) return false;
  // Backward compatibility: before explicit confirmations were tracked,
  // a changed rating/completed state is evidence of deliberate practice.
  return habit.completed === baseline.data.completed &&
    habit.rating === baseline.data.rating;
}

/**
 * Derived from the current account's persisted snapshot; no state writes.
 * Today overrides a stale history copy. Count distinct completed habit IDs,
 * including check-only completion, at most three points per valid local day.
 */
export function calculateConstellationGrowth(
  snapshot: Pick<Snapshot, "day" | "habits" | "history" | "state">,
): ConstellationGrowth {
  const combined: History = { ...snapshot.history };
  if (validDay(snapshot.day)) combined[snapshot.day] = snapshot.habits;
  const days: GrowthDay[] = [];
  let totalPoints = 0;
  let totalCompletedHabits = 0;
  for (const [day, habits] of Object.entries(combined).sort(([a], [b]) => a.localeCompare(b))) {
    if (!validDay(day)) continue;
    const completed = new Set<string>();
    for (const habit of habits) {
      if (
        !habit.completed || !habit.id ||
        isUnconfirmedDemoCompletion(snapshot.state, day, habit)
      ) continue;
      completed.add(habit.id);
    }
    const completedHabits = completed.size;
    const points = Math.min(3, completedHabits);
    days.push({ day, completedHabits, points });
    totalPoints += points;
    totalCompletedHabits += completedHabits;
  }
  return { totalPoints, totalCompletedHabits, days };
}
