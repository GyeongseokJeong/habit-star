import { describe, expect, it } from "vitest";
import { scheduledTimeGroup, timeForSelectedGroup, templateGroupForTime } from "../lib/habits/habit-editor-time";

describe("habit editor time and time-group consistency", () => {
  it("classifies morning, day and late-night boundaries", () => {
    for (const [time, group] of [
      ["04:59", "night"], ["05:00", "morning"], ["10:59", "morning"],
      ["11:00", "day"], ["16:48", "day"], ["16:59", "day"],
      ["17:00", "night"], ["23:59", "night"], ["00:00", "night"],
    ] as const) expect(scheduledTimeGroup(time)).toBe(group);
    expect(scheduledTimeGroup("")).toBeNull();
    expect(scheduledTimeGroup("25:00")).toBeNull();
  });

  it("keeps a new habit's optional time empty even when a group is selected", () => {
    expect(timeForSelectedGroup(undefined,"night")).toBeUndefined();
    expect(timeForSelectedGroup("","morning")).toBe("");
  });

  it("keeps valid times and aligns out-of-range times to sensible defaults", () => {
    expect(timeForSelectedGroup("16:48","night")).toBe("21:00");
    expect(timeForSelectedGroup("23:30","night")).toBe("23:30");
    expect(timeForSelectedGroup("21:00","day")).toBe("13:00");
    expect(timeForSelectedGroup("07:45","morning")).toBe("07:45");
  });

  it("preserves manually selected times through template changes without mismatching groups", () => {
    expect(templateGroupForTime("16:48","night",true)).toBe("day");
    expect(templateGroupForTime("22:00","morning",true)).toBe("night");
    expect(templateGroupForTime("16:48","night",false)).toBe("night");
    expect(templateGroupForTime(undefined,"day",true)).toBe("day");
  });
});
