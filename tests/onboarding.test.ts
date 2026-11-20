import { describe, expect, it } from "vitest";
import { canCelebrateFirstPractice, getFirstUseState } from "../lib/habits/onboarding";
import type { Habit, Entity } from "../lib/habits/domain";
import type { Snapshot, State } from "../lib/habits/repository";

const habit = (id: string, completed = false): Habit => ({
  id, title: id, icon: "📚", timeGroup: "night",
  alarmEnabled: false, completed, rating: completed ? 4 : 0, memo: "",
});
const entity = (kind: Entity["kind"], id: string, day = "", completed = false): Entity => ({
  key: kind === "habit_entries" ? "habit_entries:" + day + ":" + id : "habits::" + id,
  kind, id, day, data: kind === "habits" ? { title: id } : { completed },
  version: 0, deleted: false,
});
const demoState = (): State => ({
  cursor: 0, timezone: "Asia/Seoul", outbox: [], conflicts: [],
  entities: {
    "habits::sample": entity("habits", "sample"),
    "habit_entries:2026-11-20:sample": entity("habit_entries", "sample", "2026-11-20", true),
  },
  migration: {
    entities: [entity("habits", "sample"), entity("habit_entries", "sample", "2026-11-20", true)],
    issues: [], mapping: {},
    backup: {
      raw: { byeolharu_v1_habits: null, byeolharu_v1_history: null, byeolharu_v1_day: null },
      sourceId: "demo", capturedAt: "2026-11-20T00:00:00Z",
    },
  },
});
const snap = (state: State, habits = [habit("sample", true)]): Snapshot => ({
  day: "2026-11-20", habits, history: {}, state,
});

describe("minimal first-use journey", () => {
  it("classifies fresh guest examples and shows the small hint", () => {
    const state = demoState();
    const first = getFirstUseState(snap(state), false);
    expect(first.showHint).toBe(true);
    expect(first.sampleIds.has("sample")).toBe(true);
    expect(first.hasRealCompletion).toBe(false);
    expect(canCelebrateFirstPractice(snap(state), false, habit("sample"), true)).toBe(false);
  });
  it("celebrates only the first user-created real completion", () => {
    const state = demoState();
    state.entities["habits::mine"] = entity("habits", "mine");
    expect(getFirstUseState(snap(state), false).showHint).toBe(false);
    expect(canCelebrateFirstPractice(snap(state), false, habit("mine"), true)).toBe(true);
    expect(canCelebrateFirstPractice(snap(state), false, habit("mine", true), true)).toBe(false);
    state.entities["habit_entries:2026-11-20:mine"] = entity("habit_entries", "mine", "2026-11-20", true);
    expect(canCelebrateFirstPractice(snap(state), false, habit("mine"), true)).toBe(false);
    expect(getFirstUseState(snap(state), false).hasRealCompletion).toBe(true);
  });
  it("does not reintroduce the hint on edited or legacy guests", () => {
    const state = demoState();
    state.hasUserEdits = true;
    expect(getFirstUseState(snap(state), false).showHint).toBe(false);
    const legacy = demoState();
    legacy.migration!.backup.raw.byeolharu_v1_habits = "[]";
    expect(getFirstUseState(snap(legacy), false).showHint).toBe(false);
  });
  it("waits for member sync, and never overwrites existing member experience", () => {
    const state = demoState();
    delete state.migration;
    expect(getFirstUseState(snap(state), true).showHint).toBe(false);
    state.hydrated = true;
    expect(getFirstUseState(snap(state), true).showHint).toBe(false);
    state.entities = {};
    expect(getFirstUseState(snap(state, []), true).showHint).toBe(true);
    state.entities["habit_entries:2026-11-19:past"] = entity("habit_entries", "past", "2026-11-19", true);
    expect(getFirstUseState(snap(state), true).showHint).toBe(false);
  });
});
