import { describe, expect, it } from "vitest";
import { buildWidgetSummary, widgetExpiry } from "../lib/habits/widget-summary";
import type { Habit } from "../lib/habits/domain";
import type { Snapshot } from "../lib/habits/repository";

const now = new Date("2026-11-24T12:00:00+09:00"), date = "2026-11-24";
const base: Habit = { id: "private-id", title: "private title", icon: "📚", timeGroup: "morning",
  alarmEnabled: false, completed: true, rating: 0, memo: "private memo" };
const habits: Habit[] = [base, { ...base, id: "2", completed: false, timeGroup: "night" },
  { ...base, id: "3", repeatDays: [0], completed: false }];
const snapshot: Snapshot = { day: date, habits, history: { [date]: habits }, state: {
  entities: {}, outbox: [], conflicts: [], cursor: 0, hydrated: true, timezone: "Asia/Seoul" } };
describe("anonymous widget projection", () => {
  it("uses scheduled records and shared growth without transmitting private values", () => {
    const result = buildWidgetSummary(snapshot, "private-user", now);
    expect(result).toEqual({ ready: true, expiresAt: Date.parse("2026-11-25T00:00:00+09:00"),
      completed: 1, total: 2, morning: 0, day: 0, night: 1, stage: 1, points: 1 });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("clears on missing, unhydrated or stale snapshots", () => {
    expect(buildWidgetSummary(null, null, now)).toBeNull();
    expect(buildWidgetSummary({ ...snapshot, state: { ...snapshot.state, hydrated: false } }, "u", now)).toBeNull();
    expect(buildWidgetSummary({ ...snapshot, history: {} }, "u", now)).toBeNull();
    expect(buildWidgetSummary({ ...snapshot, day: "2026-11-23" }, "u", now)).toBeNull();
  });
  it("handles DST spring and fall boundaries", () => {
    expect(widgetExpiry(new Date("2026-03-08T00:00:00-08:00"), "America/Los_Angeles")).toBe(Date.parse("2026-03-09T00:00:00-07:00"));
    expect(widgetExpiry(new Date("2026-11-01T00:00:00-07:00"), "America/Los_Angeles")).toBe(Date.parse("2026-11-02T00:00:00-08:00"));
  });
});
