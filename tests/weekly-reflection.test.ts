import { describe, expect, it } from "vitest";
import { calculateWeeklyReflection, nextScheduledDay, shiftDay } from "../lib/habits/weekly-reflection";
import { entityKey, type Habit, type Entity } from "../lib/habits/domain";
import type { Snapshot, State } from "../lib/habits/repository";

const TODAY = "2026-11-20";
const habit = (id: string, completed = false, repeatDays?: number[]): Habit => ({
  id, title: id, icon: "📚", timeGroup: "night", alarmEnabled: false,
  completed, rating: completed ? 4 : 0, memo: "", repeatDays,
});
const emptyState = (): State => ({
  entities: {}, outbox: [], conflicts: [], cursor: 0, timezone: "Asia/Seoul",
});
const snapshot = (now: Habit[], history: Snapshot["history"], patch: Partial<State> = {}): Snapshot => ({
  day: TODAY, habits: now, history, state: { ...emptyState(), ...patch },
});
const days = ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];
const dated = (records: Record<string, Habit[]>): Snapshot["history"] => ({ ...records });

describe("weekly reflection V1", () => {
  it("excludes today and uses the previous seven calendar days even across month boundaries", () => {
    expect(shiftDay("2026-12-01", -1)).toBe("2026-11-30");
    expect(shiftDay("2026-11-20", -7)).toBe("2026-11-13");
    const h = habit("reading");
    const history = Object.fromEntries([...days.slice(0, 3).map(day => [day, [h]]), [TODAY, [h]]]);
    const result = calculateWeeklyReflection(snapshot([h], history));
    expect(result.startDay).toBe("2026-11-13");
    expect(result.endDay).toBe("2026-11-19");
    expect(result.recommendations[0]).toMatchObject({ observedDays: 3, completedDays: 0, missedDays: 3 });
  });

  it("does not count a missing date, missing habit, or off-schedule day as failure", () => {
    const h = habit("reading", false, [1, 2, 3, 4, 5]); // Mon-Fri
    const history = dated({
      "2026-11-13": [h], // Friday
      "2026-11-14": [h], // Saturday: off schedule
      "2026-11-16": [],  // recorded day without this habit
      "2026-11-17": [h],
      // Remaining dates were not visited
    });
    const result = calculateWeeklyReflection(snapshot([h], history));
    expect(result.status).toBe("insufficient");
    expect(result.recommendations).toEqual([]);
  });

  it("uses each historical record's repeat schedule, not today's updated settings", () => {
    const today = habit("reading", false, [6]); // Changed to Saturday today
    const historical = habit("reading", false, [1, 2, 3, 4, 5]);
    const history = dated({
      "2026-11-16": [historical],
      "2026-11-17": [historical],
      "2026-11-18": [historical],
    });
    const result = calculateWeeklyReflection(snapshot([today], history));
    expect(result.recommendations[0].observedDays).toBe(3);
    expect(result.recommendations[0].todayScheduled).toBe(false);
    expect(result.recommendations[0].nextScheduledDay).toBe("2026-11-21");
  });

  it("prioritizes missed days, handles check-only completion, and limits recommendations to two", () => {
    const a = habit("a"); const b = habit("b"); const c = habit("c");
    const history = Object.fromEntries(days.map((day, index) => [
      day,
      [index === 0 ? habit("a", true) : a, index < 2 ? habit("b", true) : b, index < 3 ? habit("c", true) : c],
    ]));
    // Check-only completion is accepted even with rating zero.
    history[days[0]][0] = { ...habit("a", true), rating: 0 };
    const result = calculateWeeklyReflection(snapshot([a, b, c], history));
    expect(result.status).toBe("restart");
    expect(result.recommendations.map(item => item.id)).toEqual(["a", "b"]);
    expect(result.recommendations[0]).toMatchObject({ observedDays: 7, completedDays: 1, missedDays: 6 });
  });

  it("ignores removed habits and seeded guest sample completions", () => {
    const seeded = habit("seed", true);
    const real = habit("real");
    const legacyRaw = { byeolharu_v1_habits: null, byeolharu_v1_history: null, byeolharu_v1_day: null };
    const seededEntity = (day: string): Entity => ({
      key: entityKey("habit_entries", "seed", day),
      kind: "habit_entries", id: "seed", day, version: 0, deleted: false,
      data: { ...seeded },
    });
    const historical = Object.fromEntries(days.slice(0, 4).map(day =>
      [day, [seeded, real, habit("removed")]],
    ));
    const result = calculateWeeklyReflection(snapshot(
      [seeded, real], historical,
      { migration: {
        backup: { raw: legacyRaw, capturedAt: "", sourceId: "sample" },
        issues: [], mapping: {}, entities: days.slice(0, 4).map(seededEntity),
      } },
    ));
    expect(result.recommendations.map(item => item.id)).toEqual(["real"]);
    expect(result.encouragingHabit).toBeNull();
  });

  it("uses the current scope only and never mutates the snapshot", () => {
    const h = habit("reading");
    const history = dated({
      "2026-11-13": [h], "2026-11-14": [h], "2026-11-15": [h],
    });
    const a = snapshot([h], history);
    const before = JSON.stringify(a);
    expect(calculateWeeklyReflection(a).recommendations).toHaveLength(1);
    expect(JSON.stringify(a)).toBe(before);
    const b = snapshot([habit("other")], history);
    expect(calculateWeeklyReflection(b).recommendations).toEqual([]);
  });

  it("does not claim success when there are records but no observed completions", () => {
    const h = habit("reading");
    const history = dated({
      "2026-11-13": [h], "2026-11-14": [h], "2026-11-15": [h],
    });
    const result = calculateWeeklyReflection(snapshot([h], history));
    expect(result.status).toBe("restart");
    const few = calculateWeeklyReflection(snapshot([h], { "2026-11-13": [h] }));
    expect(few.status).toBe("insufficient");
  });

  it("shows encouragement only with actual strong performance", () => {
    const h = habit("reading");
    const history = Object.fromEntries(days.slice(0, 5).map((day, index) => [
      day, [habit("reading", index !== 4)],
    ]));
    const result = calculateWeeklyReflection(snapshot([h], history));
    expect(result.status).toBe("steady");
    expect(result.encouragingHabit?.completedDays).toBe(4);
    expect(result.recommendations).toHaveLength(0);
  });

  it("returns the correct next date for a habit scheduled once per week", () => {
    expect(nextScheduledDay(habit("once", false, [1]), TODAY)).toBe("2026-11-23");
  });
});
