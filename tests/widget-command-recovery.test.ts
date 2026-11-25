import { describe, expect, it } from "vitest";
import { LocalRepository } from "../lib/habits/repository";
import { buildWidgetActionProjection } from "../lib/habits/widget-summary";
import { newWidgetCommandGeneration, recoverableWidgetProjection, recoverWidgetPracticeCommand } from "../lib/habits/widget-command-recovery";
import { readWidgetCommandGeneration, writeWidgetCommandGeneration } from "../mobile/packaged-guest/widget-command-generation";

const ORIGIN = "https://localhost";
async function setup() {
  const id = crypto.randomUUID();
  const r = new LocalRepository("member:" + id, () => [], { getItem: () => null });
  await r.initialize();
  await r.mutate(s => { s.hydrated = true; });
  await r.ensureDay();
  const habit = { id: crypto.randomUUID(), title: "독서", icon: "📚", timeGroup: "night" as const,
    alarmEnabled: false, completed: false, rating: 0, memo: "private memo" };
  await r.create(habit);
  return { r, id, habit };
}
describe("widget recoverable handles (no cold write)", () => {
  it("recovers the same validated command from a fresh snapshot and only a generation secret", async () => {
    const {r,id,habit} = await setup();
    try {
      const snapshot = await r.load();
      const original = buildWidgetActionProjection(snapshot,id);
      const generation = newWidgetCommandGeneration(original.summary!);
      const projected = await recoverableWidgetProjection(original,generation);
      const key = projected.summary!.rows[0].actionKey!;
      expect(key).toMatch(/^[0-9a-f-]{36}$/);
      expect(key).not.toBe(original.summary!.rows[0].actionKey);
      expect(JSON.stringify(projected.summary)).not.toContain(habit.id);
      expect(JSON.stringify(projected.summary)).not.toContain(id);
      expect(JSON.stringify(projected.summary)).not.toContain("private memo");
      const before = await r.state();
      await writeWidgetCommandGeneration(ORIGIN,generation);
      const stored = await readWidgetCommandGeneration(ORIGIN);
      expect(stored).toEqual(generation);
      expect(Object.keys(stored!).sort()).toEqual(["expiresAt","nonce"]);
      expect(await recoverWidgetPracticeCommand(await r.load(),id,key,stored!)).toEqual(projected.commands.get(key));
      expect(await r.state()).toEqual(before);
      expect(await recoverWidgetPracticeCommand(snapshot,"other-account",key,generation)).toBeNull();
      expect(await recoverWidgetPracticeCommand(snapshot,id,key,newWidgetCommandGeneration(original.summary!))).toBeNull();
      expect(await recoverWidgetPracticeCommand(snapshot,id,key,generation,new Date(generation.expiresAt))).toBeNull();
      expect(await recoverWidgetPracticeCommand(snapshot,id,"invalid",generation)).toBeNull();
      await r.update(habit.id,{completed:true,rating:4});
      expect(await recoverWidgetPracticeCommand(await r.load(),id,key,generation)).toBeNull();
      await r.update(habit.id,{completed:false,rating:0});
      expect(await recoverWidgetPracticeCommand(await r.load(),id,key,generation)).toBeNull();
    } finally { await writeWidgetCommandGeneration(ORIGIN,null); r.close(); }
  });
  it("replaces a generation and clears it without creating a record queue", async () => {
    const {r,id} = await setup();
    try {
      const summary = buildWidgetActionProjection(await r.load(),id).summary!;
      const a = newWidgetCommandGeneration(summary), b = newWidgetCommandGeneration(summary);
      await writeWidgetCommandGeneration(ORIGIN,a);
      await writeWidgetCommandGeneration(ORIGIN,b);
      expect(await readWidgetCommandGeneration(ORIGIN)).toEqual(b);
      expect(await readWidgetCommandGeneration(ORIGIN,b.expiresAt)).toBeNull();
      expect(await readWidgetCommandGeneration("https://example.com")).toBeNull();
      await expect(writeWidgetCommandGeneration("https://example.com",a)).rejects.toThrow("widget_generation_origin");
      await writeWidgetCommandGeneration(ORIGIN,null);
      expect(await readWidgetCommandGeneration(ORIGIN)).toBeNull();
    } finally { await writeWidgetCommandGeneration(ORIGIN,null); r.close(); }
  });
});
