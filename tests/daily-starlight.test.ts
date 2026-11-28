import { describe, expect, it } from "vitest";
import { dailyStarlight } from "../lib/habits/daily-starlight";
import { stats, type Habit } from "../lib/habits/domain";

const day = "2026-11-28"; // Saturday
const habit = (rating: number, repeatDays?: number[]): Habit => ({
  id: String(rating), title: "습관", icon: "⭐", timeGroup: "morning",
  alarmEnabled: false, completed: rating > 0, rating, memo: "", repeatDays,
});
const records = (ratings: number[]) => ratings.map((rating, index) => ({ ...habit(rating), id: String(index) }));

describe("daily calendar starlight", () => {
  it.each([
    [[5, 0, 0, 0, 0, 0, 0, 0], 12.5, 1],
    [[5, 5, 5, 5, 0, 0, 0, 0], 50, 3],
    [[3, 3, 3, 3, 3, 3, 3, 3], 60, 3],
    [[5, 5, 5, 5, 5, 5, 5, 5], 100, 5],
    [[5], 100, 5],
    [[0, 0], 0, 0],
  ] as const)("uses the entire scheduled day: %j", (ratings, percent, tier) => {
    expect(dailyStarlight(records([...ratings]), day)).toMatchObject({ percent, tier });
  });
  it("excludes non-scheduled habits using the historical day", () => {
    expect(dailyStarlight([habit(5, [6]), habit(0, [1]), habit(5, [2])], day)).toMatchObject({
      scheduledCount: 1, completedCount: 1, percent: 100, tier: 5,
    });
  });
  it("distinguishes unknown days and rest days from scheduled but unrecorded habits", () => {
    expect(dailyStarlight(undefined, day)).toMatchObject({ state: "unrecorded", tier: 0 });
    expect(dailyStarlight([], day)).toMatchObject({ state: "rest", tier: 0 });
    expect(dailyStarlight([habit(0, [1])], day)).toMatchObject({ state: "rest", tier: 0 });
    expect(dailyStarlight([habit(0)], day)).toMatchObject({ state: "scheduled", tier: 0 });
  });
  it("does not invent a rating or change the recorded-only average", () => {
    const habits = [{ ...habit(0), completed: true }, habit(5), habit(0)];
    expect(dailyStarlight(habits, day)).toMatchObject({ completedCount: 2, tier: 2 });
    expect(stats(habits, day).average).toBe(5);
  });
});
