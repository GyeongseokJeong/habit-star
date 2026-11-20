import { describe, expect, it } from "vitest";
import { summarizeWeeklyStarlight } from "../lib/constellation/weekly-report";
import { calculateConstellationGrowth } from "../lib/constellation/growth";
import type { Habit } from "../lib/habits/domain";
import type { Snapshot, State } from "../lib/habits/repository";

const state: State = {
  entities: {}, outbox: [], conflicts: [], cursor: 0, timezone: "Asia/Seoul",
};
const habit = (id: string, completed = true): Habit => ({
  id, title: id, icon: "⭐", timeGroup: "morning",
  alarmEnabled: false, completed, rating: 0, memo: "",
});
const snapshot = (
  today: string,
  habits: Habit[],
  history: Snapshot["history"] = {},
): Snapshot => ({ day: today, habits, history, state });

describe("V6 STEP 1 weekly starlight projection", () => {
  it("uses Monday–Sunday boundaries including year/month rollover", () => {
    const result = summarizeWeeklyStarlight({ days: [] }, "2027-01-01");
    expect(result.startDay).toBe("2026-12-28");
    expect(result.endDay).toBe("2027-01-03");
    expect(result.days).toHaveLength(7);
    expect(result.days[0].day).toBe("2026-12-28");
    expect(result.days[6].day).toBe("2027-01-03");
    expect(result.days.filter(x => x.isFuture)).toHaveLength(2);
    expect(result.isComplete).toBe(false);
  });

  it("computes a prior week's completion and totals without penalizing blank days", () => {
    const report = summarizeWeeklyStarlight({ days: [
      { day: "2026-11-09", completedHabits: 5, points: 3 },
      { day: "2026-11-11", completedHabits: 2, points: 2 },
      { day: "2026-11-14", completedHabits: 1, points: 1 },
      { day: "2026-11-16", completedHabits: 1, points: 1 },
    ] }, "2026-11-21", 1);
    expect([report.startDay, report.endDay]).toEqual(["2026-11-09", "2026-11-15"]);
    expect(report.totalCompletedHabits).toBe(8);
    expect(report.totalPoints).toBe(6);
    expect(report.practiceDays).toBe(3);
    expect(report.days.filter(d => d.completedHabits === 0)).toHaveLength(4);
    expect(report.days.every(d => !d.isFuture)).toBe(true);
    expect(report.isComplete).toBe(true);
  });

  it("preserves the V3.2 cap, check-only completions, today's override and deduplication", () => {
    const current = snapshot("2026-11-21", [habit("a"), habit("b"), habit("c"), habit("d")], {
      "2026-11-16": [habit("x"), habit("x"), habit("y")],
      "2026-11-20": [habit("m", false)],
      "2026-11-21": [habit("old"), habit("old2")],
    });
    const growth = calculateConstellationGrowth(current);
    const report = summarizeWeeklyStarlight(growth, current.day);
    expect(report.days.find(d => d.day === "2026-11-16")).toMatchObject({ completedHabits: 2, points: 2 });
    expect(report.days.find(d => d.day === "2026-11-21")).toMatchObject({ completedHabits: 4, points: 3 });
    expect(report.totalCompletedHabits).toBe(6);
    expect(report.totalPoints).toBe(5);
    expect(report.practiceDays).toBe(2);
  });

  it("excludes accidentally persisted future records rather than counting them", () => {
    const report = summarizeWeeklyStarlight({ days: [
      { day: "2026-11-21", completedHabits: 1, points: 1 },
      { day: "2026-11-22", completedHabits: 20, points: 3 },
    ] }, "2026-11-21");
    expect(report.totalCompletedHabits).toBe(1);
    expect(report.totalPoints).toBe(1);
    expect(report.days[6]).toMatchObject({ day: "2026-11-22", isFuture: true, completedHabits: 0, points: 0 });
  });

  it("handles Sundays, leap-year rollover and a complete previous week consistently", () => {
    const sunday = summarizeWeeklyStarlight({ days: [] }, "2024-03-03");
    expect([sunday.startDay, sunday.endDay, sunday.isComplete]).toEqual(["2024-02-26", "2024-03-03", false]);
    expect(summarizeWeeklyStarlight({ days: [] }, "2024-03-04", 1)).toMatchObject({
      startDay: "2024-02-26", endDay: "2024-03-03", isComplete: true,
    });
  });

  it("is pure, ignores out-of-window records and never changes growth rows", () => {
    const growth = { days: [
      { day: "2026-11-15", completedHabits: 2, points: 2 },
      { day: "2026-11-16", completedHabits: 1, points: 1 },
      { day: "bad", completedHabits: 99, points: 3 },
    ] };
    const prior = JSON.stringify(growth);
    const report = summarizeWeeklyStarlight(growth, "2026-11-21");
    expect(report.totalPoints).toBe(1);
    expect(report.totalCompletedHabits).toBe(1);
    expect(JSON.stringify(growth)).toBe(prior);
  });

  it("rejects invalid date keys and invalid week offsets", () => {
    expect(() => summarizeWeeklyStarlight({ days: [] }, "2026-02-30")).toThrow(RangeError);
    for (const weeksAgo of [-1, 0.5, 521, Number.NaN]) {
      expect(() => summarizeWeeklyStarlight({ days: [] }, "2026-11-21", weeksAgo)).toThrow(RangeError);
    }
  });
});
