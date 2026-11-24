import { describe, expect, it } from "vitest";
import { parseHabitReminder, resolveHabitReminder } from "../lib/habits/reminder-navigation";
import { dateKey, type Habit } from "../lib/habits/domain";

const now = new Date("2026-11-24T12:00:00+09:00");
const day = dateKey(now, "Asia/Seoul");
const habit: Habit = { id: "reading", title: "독서", icon: "📚", timeGroup: "night",
  scheduledTime: "21:00", alarmEnabled: true, completed: false, rating: 0, memo: "" };
const target = { scope: "member:alice", day, habitId: habit.id };
const snapshot = { day, history: { [day]: [habit] }, state: { hydrated: true, timezone: "Asia/Seoul" } };
const context = { snapshot, memberId: "alice", habits: [habit], now, blocked: false };
const extra = { ...target, kind: "byeolharu-habit-reminder-v1", category: "habit" };

describe("native individual reminder navigation", () => {
  it("parses only valid individual targets, never wrapup or unrelated notifications", () => {
    expect(parseHabitReminder(extra)).toEqual(target);
    for (const invalid of [null, {}, { ...extra, category: "wrapup" },
      { ...extra, kind: "other" }, { ...extra, scope: "member:" },
      { ...extra, scope: "demo" }, { ...extra, day: "2026-02-30" },
      { ...extra, habitId: "" }]) expect(parseHabitReminder(invalid)).toBeNull();
  });
  it("waits for verified member hydration and today's entries", () => {
    expect(resolveHabitReminder(target, { ...context, snapshot: null })).toEqual({ kind: "wait" });
    expect(resolveHabitReminder(target, { ...context, snapshot: { ...snapshot, state: { ...snapshot.state, hydrated: false } } })).toEqual({ kind: "wait" });
    expect(resolveHabitReminder(target, { ...context, snapshot: { ...snapshot, history: {} } })).toEqual({ kind: "wait" });
    expect(resolveHabitReminder(target, context)).toEqual({ kind: "open", habit });
  });
  it("allows a valid guest target with device-local day", () => {
    const localDay = dateKey(now);
    expect(resolveHabitReminder({ ...target, scope: "guest", day: localDay },
      { ...context, memberId: null, snapshot: { ...snapshot, day: localDay } })).toEqual({ kind: "open", habit });
  });
  it("ignores cross-account, stale, deleted and already completed targets", () => {
    const cases: Array<Parameters<typeof resolveHabitReminder>> = [
      [{ ...target, scope: "member:bob" }, context],
      [{ ...target, scope: "guest" }, context],
      [{ ...target, day: "2026-11-23" }, context],
      [target, { ...context, habits: [] }],
      [target, { ...context, habits: [{ ...habit, completed: true }] }],
      [target, { ...context, habits: [{ ...habit, alarmEnabled: false }] }],
      [target, { ...context, habits: [{ ...habit, repeatDays: [0] }] }],
      [target, { ...context, blocked: true }],
    ];
    for (const [t, c] of cases) expect(resolveHabitReminder(t, c)).toEqual({ kind: "ignore" });
  });
  it("waits for rollover instead of navigating into yesterday's snapshot", () => {
    const yesterday = "2026-11-23";
    expect(resolveHabitReminder(target, { ...context, snapshot: { ...snapshot, day: yesterday, history: { [yesterday]: [habit] } } })).toEqual({ kind: "wait" });
  });
});
