import { describe, expect, it } from "vitest";
import { sortHabitsForDisplay } from "../lib/habits/display-order";

type Routine = {
  id: string;
  scheduledTime?: string;
  completed: boolean;
  timeGroup?: "morning" | "day" | "night";
};
const item = (
  id: string,
  scheduledTime?: string,
  completed = false,
  timeGroup: Routine["timeGroup"] = "night",
): Routine => ({ id, scheduledTime, completed, timeGroup });
const ids = (items: Routine[]) => items.map((habit) => habit.id);

describe("stable habit card display ordering", () => {
  it("shows earlier times first, even if they have already passed", () => {
    const original = [
      item("read", "21:30"),
      item("free-1"),
      item("exercise", "21:00"),
      item("bed", "23:30"),
      item("free-2", ""),
      item("morning", "07:00", false, "morning"),
    ];
    expect(ids(sortHabitsForDisplay(original))).toEqual([
      "morning", "exercise", "read", "bed", "free-1", "free-2",
    ]);
    expect(ids(original)).toEqual([
      "read", "free-1", "exercise", "bed", "free-2", "morning",
    ]);
  });

  it("keeps completed routines folded below unfinished routines, sorting both groups", () => {
    const routines = [
      item("done-late", "22:00", true),
      item("pending-free"),
      item("pending-late", "23:00"),
      item("done-early", "07:00", true),
      item("pending-early", "21:00"),
      item("done-free", undefined, true),
    ];
    expect(ids(sortHabitsForDisplay(routines, (habit) => habit.completed))).toEqual([
      "pending-early", "pending-late", "pending-free",
      "done-early", "done-late", "done-free",
    ]);
  });

  it("uses the held completion state while a newly rated habit waits to move", () => {
    const routines = [
      item("late", "21:30"),
      item("early", "21:00", true),
      item("free", undefined, true),
    ];
    const heldCompletion = new Map([["early", false]]);
    expect(ids(sortHabitsForDisplay(
      routines,
      (habit) => heldCompletion.get(habit.id) ?? habit.completed,
    ))).toEqual(["early", "late", "free"]);
    expect(ids(sortHabitsForDisplay(routines, (habit) => habit.completed)))
      .toEqual(["late", "early", "free"]);
  });

  it("preserves registration order for equal times and unscheduled habits", () => {
    const routines = [
      item("late-A", "22:00"),
      item("free-A"),
      item("same-A", "21:00"),
      item("same-B", "21:00"),
      item("free-B"),
      item("late-B", "22:00"),
    ];
    expect(ids(sortHabitsForDisplay(routines))).toEqual([
      "same-A", "same-B", "late-A", "late-B", "free-A", "free-B",
    ]);
  });

  it("does not move a past-due habit behind future ones and does not mutate input", () => {
    const routines = [
      item("future", "23:30"),
      item("past", "21:00"),
      item("free"),
    ];
    const refs = [...routines];
    const ordered = sortHabitsForDisplay(routines);
    expect(ids(ordered)).toEqual(["past", "future", "free"]);
    expect(routines).toEqual(refs);
    expect(ordered[0]).toBe(refs[1]);
    expect(ordered).not.toBe(routines);
  });

  it("orders the upcoming preview by time without changing any completion status", () => {
    const upcoming = [
      item("night-late", "23:00", false),
      item("night-free"),
      item("night-early", "20:00"),
    ];
    expect(ids(sortHabitsForDisplay(upcoming))).toEqual([
      "night-early", "night-late", "night-free",
    ]);
    expect(upcoming.every((habit) => !habit.completed)).toBe(true);
  });
});
