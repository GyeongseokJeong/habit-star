import { describe, expect, it } from "vitest";
import type { HabitSettingsPatch, DailyRecordPatch } from "../lib/habits/domain";
import { hasUnsavedHabitSettings, hasUnsavedDailyRecord } from "../lib/habits/unsaved-draft";

const habit: HabitSettingsPatch = {
  title: "독서 20분", icon: "📚", timeGroup: "night",
  scheduledTime: undefined, repeatDays: [1, 2, 3, 4, 5, 6, 0], alarmEnabled: false,
};

describe("Android unsaved draft guard", () => {
  it("does not prompt for an unchanged habit or reordered equivalent repeat days", () => {
    expect(hasUnsavedHabitSettings(habit, { ...habit })).toBe(false);
    expect(hasUnsavedHabitSettings(habit, { ...habit, repeatDays: [0, 6, 5, 4, 3, 2, 1] })).toBe(false);
  });
  it("prompts when title, icon, time, repeat days, or alarm are changed", () => {
    expect(hasUnsavedHabitSettings(habit, { ...habit, title: "독서 30분" })).toBe(true);
    expect(hasUnsavedHabitSettings(habit, { ...habit, icon: "🌱" })).toBe(true);
    expect(hasUnsavedHabitSettings(habit, { ...habit, timeGroup: "morning" })).toBe(true);
    expect(hasUnsavedHabitSettings(habit, { ...habit, scheduledTime: "09:30" })).toBe(true);
    expect(hasUnsavedHabitSettings(habit, { ...habit, repeatDays: [1, 2, 3] })).toBe(true);
    expect(hasUnsavedHabitSettings(habit, { ...habit, alarmEnabled: true })).toBe(true);
  });
  it("detects unsaved rating, completion, and memo changes without writes", () => {
    const initial: DailyRecordPatch = { rating: 0, completed: false, memo: "" };
    expect(hasUnsavedDailyRecord(initial, { ...initial })).toBe(false);
    expect(hasUnsavedDailyRecord(initial, { ...initial, rating: 3 })).toBe(true);
    expect(hasUnsavedDailyRecord(initial, { ...initial, completed: true })).toBe(true);
    expect(hasUnsavedDailyRecord(initial, { ...initial, memo: "오늘 좋았다" })).toBe(true);
  });
});
