import { expect, it } from "vitest";
import { LocalRepository } from "../lib/habits/repository";
import { entityKey, type Habit } from "../lib/habits/domain";
import { calculateConstellationGrowth } from "../lib/constellation/growth";

const sample = (): Habit => ({
  id: crypto.randomUUID(), title: "예시 완료 습관", icon: "⭐",
  timeGroup: "morning", alarmEnabled: false, completed: true, rating: 5, memo: "",
});

it("tracks actual completed guest demo records across reload and reversal", async () => {
  const h = sample();
  const r = new LocalRepository(
    `guest:constellation:${crypto.randomUUID()}`,
    () => [h],
    { getItem: () => null },
  );
  try {
    await r.initialize();
    const initial = await r.load();
    // Legacy migration re-identifies seeded demo records with new UUIDs.
    const seededId = initial.habits[0].id;
    expect(calculateConstellationGrowth(initial).totalPoints).toBe(0);
    expect(initial.state.demoConfirmedDailyEntryKeys).toBeUndefined();

    // Editing only display settings must not magically add growth.
    await r.update(seededId, { title: "새 이름" });
    expect(calculateConstellationGrowth(await r.load()).totalPoints).toBe(0);

    await r.update(seededId, { rating: 3, completed: true });
    const updated = await r.load();
    expect(updated.state.demoConfirmedDailyEntryKeys).toContain(
      entityKey("habit_entries", seededId, updated.day),
    );
    expect(calculateConstellationGrowth(updated).totalPoints).toBe(1);

    // Reverting back to the demo's original rating cannot erase user intent.
    await r.update(seededId, { rating: 5, completed: true });
    expect(calculateConstellationGrowth(await r.load()).totalPoints).toBe(1);

    // Explicitly cancelling the record drops growth, not its audit marker.
    await r.update(seededId, { rating: 0, completed: false });
    expect(calculateConstellationGrowth(await r.load()).totalPoints).toBe(0);
    await r.update(seededId, { rating: 0, completed: true });
    expect(calculateConstellationGrowth(await r.load()).totalPoints).toBe(1);
  } finally {
    r.close();
  }
});

it("keeps guest and member growth in separate repository scopes", async () => {
  const id = crypto.randomUUID();
  const guest = new LocalRepository(`guest:growth-${id}`, () => [], { getItem: () => null });
  const member = new LocalRepository(`member:growth-${id}`);
  try {
    await guest.initialize();
    await member.initialize();
    const guestHabit = sample();
    const memberHabit = sample();
    await guest.create(guestHabit);
    await member.create(memberHabit);
    await guest.update(guestHabit.id, { completed: true, rating: 0 });
    expect(calculateConstellationGrowth(await guest.load()).totalPoints).toBe(1);
    expect(calculateConstellationGrowth(await member.load()).totalPoints).toBe(0);
    await member.update(memberHabit.id, { completed: true, rating: 3 });
    expect(calculateConstellationGrowth(await member.load()).totalPoints).toBe(1);
    await guest.update(guestHabit.id, { completed: false, rating: 0 });
    expect(calculateConstellationGrowth(await guest.load()).totalPoints).toBe(0);
    expect(calculateConstellationGrowth(await member.load()).totalPoints).toBe(1);
  } finally {
    guest.close();
    member.close();
  }
});
