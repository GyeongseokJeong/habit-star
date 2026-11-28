import { describe, expect, it } from "vitest";
import { LocalRepository } from "../lib/habits/repository";
import { entityKey, stats, type Habit } from "../lib/habits/domain";
import { createWidgetPracticeCommand, widgetPracticeTargetRating } from "../lib/habits/widget-practice";
import { calculateConstellationGrowth } from "../lib/constellation/growth";
import { buildWidgetActionProjection } from "../lib/habits/widget-summary";

const sample = (): Habit => ({
  id: crypto.randomUUID(), title: "독서", icon: "📚", timeGroup: "night",
  alarmEnabled: true, scheduledTime: "20:00", completed: false, rating: 0, memo: "",
});
async function setup(member = false) {
  const r = new LocalRepository((member ? "member:" : "guest:") + crypto.randomUUID(), () => [], { getItem: () => null });
  await r.initialize();
  if (member) {
    await r.mutate(s => { s.hydrated = true; });
    await r.ensureDay();
  }
  const habit = sample();
  await r.create(habit);
  return { r, habit };
}
async function command(r: LocalRepository, id: string) {
  const c = createWidgetPracticeCommand(await r.load(), r.scope, id);
  if (!c) throw Error("expected available command");
  return c;
}
describe("widget practice transaction", () => {
  it("rejects runtime guard failure inside the transaction without modifying original state", async () => {
    const {r,habit}=await setup();
    try {
      const c=await command(r,habit.id), before=await r.state();
      expect(await r.applyWidgetPractice(c,()=>false)).toBe("not-ready");
      expect(await r.state()).toEqual(before);
    } finally {r.close();}
  });
  it("projects opaque undo handles for every completed rating; protects inconsistent incomplete records", async () => {
    const {r,habit}=await setup(true);
    try {
      const member=r.scope.slice("member:".length), snapshot=await r.load();
      const a=buildWidgetActionProjection(snapshot,member), b=buildWidgetActionProjection(snapshot,member);
      const key=a.summary?.rows[0].actionKey;
      expect(key).toBeTruthy();
      expect(a.commands.get(key!)).toMatchObject({habitId:habit.id,scope:r.scope,completed:true});
      expect(b.commands.has(key!)).toBe(false);
      expect(JSON.stringify(a.summary)).not.toContain(habit.id);
      expect(JSON.stringify(a.summary)).not.toContain(member);
      for (const rating of [0, 1, 2, 3, 4, 5]) {
        await r.update(habit.id,{completed:true,rating});
        const rated=buildWidgetActionProjection(await r.load(),member);
        const undoKey=rated.summary?.rows[0].actionKey;
        expect(undoKey).toBeTruthy();
        expect(rated.commands.get(undoKey!)).toMatchObject({expectedRating:rating,completed:false});
        expect(rated.summary?.rows[0]).not.toHaveProperty("rating");
      }
      for (const rating of [1,2,3,4,5]) {
        await r.update(habit.id,{completed:false,rating});
        const rated=buildWidgetActionProjection(await r.load(),member);
        expect(rated.commands.size).toBe(0);
        expect(rated.summary?.rows[0].actionKey).toBeUndefined();
      }
    } finally {r.close();}
  });
  it("commits guest completion, preserves memo and definition, derives growth, and safely cancels", async () => {
    const { r, habit } = await setup();
    try {
      await r.update(habit.id, { memo: "보존할 메모" });
      const before = await r.load(), key = entityKey("habits", habit.id);
      const first = await command(r, habit.id);
      expect(await r.applyWidgetPractice(first)).toBe("saved");
      const after = await r.load();
      expect(after.habits[0]).toMatchObject({ completed: true, rating: 5, memo: "보존할 메모" });
      expect(stats(after.habits, after.day)).toMatchObject({ completed: 1, average: 5 });
      expect(after.state.entities[key]).toEqual(before.state.entities[key]);
      expect(after.state.outbox).toEqual([]);
      expect(calculateConstellationGrowth(after).totalPoints).toBe(1);
      expect(await r.applyWidgetPractice(first)).toBe("stale");
      expect(await r.applyWidgetPractice(await command(r, habit.id))).toBe("saved");
      const cancelled = await r.load();
      expect(cancelled.habits[0]).toMatchObject({ completed: false, rating: 0, memo: "보존할 메모" });
      expect(calculateConstellationGrowth(cancelled).totalPoints).toBe(0);
      expect(stats(cancelled.habits, cancelled.day)).toMatchObject({ completed: 0, average: 0 });
      expect(await r.applyWidgetPractice(first)).toBe("stale");
    } finally { r.close(); }
  });
  it("atomically queues exactly one daily entry operation for a member, even with duplicate taps", async () => {
    const { r, habit } = await setup(true);
    try {
      const before = await r.state(), c = await command(r, habit.id);
      const results = await Promise.all([r.applyWidgetPractice(c), r.applyWidgetPractice(c)]);
      expect(results.sort()).toEqual(["saved", "stale"]);
      const after = await r.state();
      expect(after.outbox).toHaveLength(before.outbox.length + 1);
      expect(after.outbox.at(-1)?.changes).toHaveLength(1);
      expect(after.outbox.at(-1)?.changes[0]).toMatchObject({
        kind: "habit_entries", id: habit.id, day: c.day, data: { completed: true, rating: 5 },
      });
      const undo = await command(r, habit.id);
      const undoResults = await Promise.all([r.applyWidgetPractice(undo), r.applyWidgetPractice(undo)]);
      expect(undoResults.sort()).toEqual(["saved", "stale"]);
      const cancelled = await r.state();
      expect(cancelled.outbox).toHaveLength(after.outbox.length + 1);
      expect(cancelled.outbox.at(-1)?.changes).toHaveLength(1);
      expect(cancelled.outbox.at(-1)?.changes[0]).toMatchObject({
        kind: "habit_entries", id: habit.id, day: c.day, data: { completed: false, rating: 0 },
      });
    } finally { r.close(); }
  });
  it("rejects another account, stale day, malformed target and cloud version change without writes", async () => {
    const { r, habit } = await setup(true);
    const other = await setup(true);
    try {
      const c = await command(r, habit.id);
      const otherBefore = await other.r.state();
      expect(await other.r.applyWidgetPractice(c)).toBe("wrong-scope");
      expect(await other.r.state()).toEqual(otherBefore);
      const before = await r.state();
      expect(await r.applyWidgetPractice({ ...c, day: "2000-01-01" })).toBe("stale");
      expect(await r.applyWidgetPractice({ ...c, completed: c.expectedCompleted })).toBe("invalid");
      expect(await r.state()).toEqual(before);
      await r.mutate(s => { s.entities[entityKey("habit_entries",habit.id,c.day)].version++; });
      const newer = await r.state();
      expect(await r.applyWidgetPractice(c)).toBe("stale");
      expect(await r.state()).toEqual(newer);
    } finally { r.close(); other.r.close(); }
  });
  it("does not overwrite a newer memo or rating with a stale action", async () => {
    const { r, habit } = await setup();
    try {
      const c = await command(r, habit.id);
      await r.update(habit.id, { memo: "새 메모" });
      expect(await r.applyWidgetPractice(c)).toBe("stale");
      await r.update(habit.id, { completed: true, rating: 5 });
      const oldUndo = await command(r, habit.id);
      await r.update(habit.id, { completed: true, rating: 4 });
      const edited = await r.state();
      expect(await r.applyWidgetPractice(oldUndo)).toBe("stale");
      expect(await r.state()).toEqual(edited);
    } finally { r.close(); }
  });
  for (const member of [false, true]) it("undoes every app-rated completion without touching memo or definition, member=" + member, async () => {
    const { r, habit } = await setup(member);
    try {
      for (const rating of [0,1,2,3,4,5]) {
        await r.update(habit.id, { completed: true, rating, memo: "기존 메모" });
        const before = await r.load();
        const undo = await command(r, habit.id);
        expect(undo).toMatchObject({ expectedCompleted: true, expectedRating: rating, completed: false });
        const results = await Promise.all([r.applyWidgetPractice(undo), r.applyWidgetPractice(undo)]);
        expect(results.sort()).toEqual(["saved", "stale"]);
        const cancelled = await r.load(), key = entityKey("habits", habit.id);
        expect(cancelled.habits[0]).toMatchObject({ completed: false, rating: 0, memo: "기존 메모" });
        expect(cancelled.state.entities[key]).toEqual(before.state.entities[key]);
        expect(stats(cancelled.habits, cancelled.day)).toMatchObject({ completed: 0, average: 0 });
        expect(calculateConstellationGrowth(cancelled).totalPoints).toBe(0);
        expect(cancelled.state.outbox).toHaveLength(before.state.outbox.length + (member ? 1 : 0));
        if (member) {
          const changes = cancelled.state.outbox.at(-1)?.changes;
          expect(changes).toHaveLength(1);
          expect(changes?.[0]).toMatchObject({ kind: "habit_entries", id: habit.id, day: undo.day,
            data: { completed: false, rating: 0, memo: "기존 메모" } });
        }
      }
    } finally { r.close(); }
  });
  it("derives only the approved rating targets, including inconsistent legacy states", async () => {
    const { r, habit } = await setup();
    try {
      const base = await command(r, habit.id);
      for (const completed of [false,true]) for (const rating of [0,1,2,3,4,5]) {
        const c = { ...base, expectedCompleted: completed, expectedRating: rating, completed: !completed };
        const expected = completed ? 0 : (rating === 0 ? 5 : null);
        expect(widgetPracticeTargetRating(c)).toBe(expected);
      }
      for (const rating of [-1, 6, 1.5, NaN, Infinity]) {
        expect(widgetPracticeTargetRating({ ...base, expectedCompleted: true, expectedRating: rating, completed: false })).toBeNull();
      }
      await r.update(habit.id, { completed: false, rating: 5 });
      const inconsistent = await command(r, habit.id);
      const before = await r.state();
      expect(await r.applyWidgetPractice(inconsistent)).toBe("requires-detail");
      expect(await r.state()).toEqual(before);
    } finally { r.close(); }
  });
  it("rejects unhydrated, import-locked, removed and non-scheduled records", async () => {
    const { r, habit } = await setup(true);
    try {
      const c = await command(r, habit.id);
      await r.mutate(s => { s.hydrated = false; });
      expect(await r.applyWidgetPractice(c)).toBe("not-ready");
      await r.mutate(s => { s.hydrated = true; s.importLock = {owner:"test",until:Date.now()+60000}; });
      expect(await r.applyWidgetPractice(c)).toBe("not-ready");
      await r.mutate(s => { delete s.importLock; });
      const weekday = new Date(c.day+"T12:00:00Z").getUTCDay();
      await r.update(habit.id, { repeatDays: [(weekday+1)%7] });
      const today = await r.load();
      expect(createWidgetPracticeCommand(today,r.scope,habit.id)).toBeNull();
      expect(await r.applyWidgetPractice({ ...c, revision: today.state.localRevision ?? 0 })).toBe("unavailable");
      await r.remove(habit.id);
      const removed = await r.load();
      expect(await r.applyWidgetPractice({ ...c, revision: removed.state.localRevision ?? 0 })).toBe("unavailable");
    } finally { r.close(); }
  });
  it("excludes seeded demo habits from direct actions", async () => {
    const demo = sample();
    const r = new LocalRepository("guest:"+crypto.randomUUID(), () => [demo], {getItem:()=>null});
    try {
      await r.initialize();
      const snapshot = await r.load();
      // Migration allocates a new persisted UUID even for fresh guest examples.
      const persistedId = snapshot.state.migration?.mapping[demo.id];
      expect(persistedId).toBeTruthy();
      if (!persistedId) throw Error("expected migrated example ID");
      expect(snapshot.habits.some(h=>h.id===persistedId)).toBe(true);
      expect(createWidgetPracticeCommand(snapshot,r.scope,persistedId)).toBeNull();
      const base = snapshot.state.entities[entityKey("habit_entries",persistedId,snapshot.day)];
      expect(base).toBeDefined();
      const before = await r.state();
      expect(await r.applyWidgetPractice({scope:r.scope,day:snapshot.day,habitId:persistedId,
        revision:snapshot.state.localRevision??0,version:base.version,expectedCompleted:false,expectedRating:0,completed:true})).toBe("unavailable");
      expect(await r.state()).toEqual(before);
    } finally { r.close(); }
  });
});
