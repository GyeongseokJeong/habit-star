import { describe, expect, it } from "vitest";
import { calculateConstellationGrowth, earnedStageFromCompletion, isFreshGuestDemo } from "../lib/constellation/growth";
import { getConstellationStage } from "../lib/constellation/art";
import { entityKey, type Habit, type Entity } from "../lib/habits/domain";
import type { Snapshot, State } from "../lib/habits/repository";

const today = "2026-11-17";
const habit = (id: string, completed = true, rating = 0): Habit => ({
  id, title: id, icon: "⭐", timeGroup: "morning", alarmEnabled: false,
  completed, rating, memo: "",
});
const state = (): State => ({
  entities: {}, outbox: [], conflicts: [], cursor: 0, timezone: "Asia/Seoul",
});
const snapshot = (
  habits: Habit[], history: Snapshot["history"] = {}, patch: Partial<State> = {},
): Snapshot => ({ day: today, habits, history, state: { ...state(), ...patch } });
const demo = (records: Habit[]): NonNullable<State["migration"]> => ({
  entities: records.map((h): Entity => ({
    key: entityKey("habit_entries", h.id, today), kind: "habit_entries",
    id: h.id, day: today, data: { ...h }, version: 0, deleted: false,
  })),
  issues: [], mapping: {},
  backup: {
    raw: {
      byeolharu_v1_habits: null,
      byeolharu_v1_history: null,
      byeolharu_v1_day: null,
    },
    capturedAt: "2026-11-17T01:00:00Z", sourceId: "source",
  },
});

describe("V3.2 growth calculation", () => {
  it.each([[0, 0], [1, 1], [2, 2], [3, 3], [5, 3]])(
    "counts %i completed habits as %i points",
    (count, expected) => {
      const result = calculateConstellationGrowth(
        snapshot(Array.from({ length: count }, (_, i) => habit(String(i)))),
      );
      expect(result.totalPoints).toBe(expected);
      expect(result.totalCompletedHabits).toBe(count);
    },
  );

  it("counts check-only and off-schedule completions", () => {
    const h = { ...habit("a", true, 0), repeatDays: [0] };
    expect(calculateConstellationGrowth(snapshot([h, habit("b", true, 5)])).totalPoints).toBe(2);
  });

  it("deduplicates IDs per day but counts separate dates", () => {
    const h = habit("same");
    expect(calculateConstellationGrowth(snapshot(
      [h, h], { "2026-11-16": [h, h] },
    ))).toMatchObject({ totalPoints: 2, totalCompletedHabits: 2 });
  });

  it("today's entry wins over the history copy and undo recalculates", () => {
    const history = { [today]: [habit("x")], "2026-11-16": [habit("y")] };
    expect(calculateConstellationGrowth(snapshot([habit("x", false)], history)).totalPoints).toBe(1);
    expect(calculateConstellationGrowth(snapshot([habit("x")], history)).totalPoints).toBe(2);
  });

  it("does not decay when a day has no practice", () => {
    expect(calculateConstellationGrowth(snapshot(
      [], { "2026-11-14": [habit("a")], "2026-11-15": [], "2026-11-16": [] },
    )).totalPoints).toBe(1);
  });

  it("maps derived points to Stage thresholds", () => {
    const history: Snapshot["history"] = {};
    for (let i = 1; i <= 7; i++) history[`2026-11-${String(i).padStart(2, "0")}`] = [habit(`h${i}`)];
    expect(getConstellationStage(calculateConstellationGrowth(snapshot([], history)).totalPoints).stage).toBe(2);
  });

  it("excludes unchanged seeded guest completions but counts new habits", () => {
    const seeded = [habit("a", true, 5), habit("b", true, 4), habit("c", true, 4)];
    const s = { migration: demo(seeded) };
    expect(isFreshGuestDemo({ ...state(), ...s })).toBe(true);
    expect(calculateConstellationGrowth(snapshot(seeded, {}, s)).totalPoints).toBe(0);
    expect(calculateConstellationGrowth(snapshot([...seeded, habit("new")], {}, s)).totalPoints).toBe(1);
  });

  it("counts sample only after changed record or explicit confirmation, not a title edit", () => {
    const h = habit("sample", true, 5);
    const s: Partial<State> = { migration: demo([h]) };
    expect(calculateConstellationGrowth(snapshot([{ ...h, title: "다른 이름" }], {}, s)).totalPoints).toBe(0);
    expect(calculateConstellationGrowth(snapshot([{ ...h, rating: 3 }], {}, s)).totalPoints).toBe(1);
    s.demoConfirmedDailyEntryKeys = [entityKey("habit_entries", h.id, today)];
    expect(calculateConstellationGrowth(snapshot([h], {}, s)).totalPoints).toBe(1);
  });

  it("does not suppress real legacy data resembling a sample", () => {
    const h = habit("x", true, 5);
    const migration = demo([h]);
    migration.backup.raw.byeolharu_v1_habits = "[]";
    expect(calculateConstellationGrowth(snapshot([h], {}, { migration })).totalPoints).toBe(1);
  });

  it.each([[6, 2], [19, 3], [49, 4], [99, 5], [199, 6]])(
    "announces only an earned Stage after %i points",
    (points, expectedStage) => {
      const history: Snapshot["history"] = {};
      for (let index = 1; index <= points; index++) {
        const day = new Date(Date.UTC(2026, 10, 17 - index)).toISOString().slice(0, 10);
        history[day] = [habit(`earlier-${index}`)];
      }
      const current = snapshot([habit("today", false)], history);
      expect(earnedStageFromCompletion(current, current.habits, habit("today"))).toBe(expectedStage);
      expect(earnedStageFromCompletion(current, current.habits, habit("today", false))).toBeNull();
      expect(earnedStageFromCompletion(current, [habit("today")], habit("today"))).toBeNull();
      expect(earnedStageFromCompletion(current, [habit("today", false), habit("other"), habit("third"), habit("fourth")], habit("today"))).toBeNull();
    },
  );

  it("recalculates after a date or account snapshot changes, without touching original history", () => {
    const guest = snapshot([], { "2026-11-16": [habit("a")] });
    const member = snapshot([], { "2026-11-16": [habit("a"), habit("b")] });
    expect(calculateConstellationGrowth(guest).totalPoints).toBe(1);
    expect(calculateConstellationGrowth(member).totalPoints).toBe(2);
    expect(calculateConstellationGrowth({ ...guest, day: "2026-11-16", habits: [] }).totalPoints).toBe(0);
    expect(calculateConstellationGrowth({ ...guest, history: { "2026-11-16": [] } }).totalPoints).toBe(0);
    expect(guest.history["2026-11-16"]).toHaveLength(1);
  });

  it("ignores malformed day strings without changing history", () => {
    const history = { "bad": [habit("wrong")], "2026-11-16": [habit("ok")] };
    const old = JSON.stringify(history);
    expect(calculateConstellationGrowth(snapshot([], history)).totalPoints).toBe(1);
    expect(JSON.stringify(history)).toBe(old);
  });
});
