import { describe, expect, it } from "vitest";
import { currentTimeGroup, initialRoutineTab, startupDataReady } from "../lib/habits/time-tab";

const at = (hour: number, minute = 0) =>
  new Date(`2026-11-19T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`);

describe("smart startup routine tabs", () => {
  it.each([
    [4, 59, "night"],
    [5, 0, "morning"],
    [10, 59, "morning"],
    [11, 0, "day"],
    [16, 59, "day"],
    [17, 0, "night"],
    [23, 59, "night"],
    [0, 0, "night"],
  ] as const)("maps %s:%s to %s in Asia/Seoul", (h, m, expected) => {
    expect(currentTimeGroup(at(h, m), "Asia/Seoul")).toBe(expected);
  });

  it("uses member timezone instead of device timezone", () => {
    const utcNoon = new Date("2026-11-19T14:30:00Z");
    expect(currentTimeGroup(utcNoon, "Asia/Seoul")).toBe("night");
    expect(currentTimeGroup(utcNoon, "America/Los_Angeles")).toBe("morning");
  });

  it("shows all instead of an empty current period", () => {
    expect(initialRoutineTab(at(8), [{ timeGroup: "night" }], "Asia/Seoul")).toBe("all");
    expect(initialRoutineTab(at(8), [], "Asia/Seoul")).toBe("all");
    expect(initialRoutineTab(at(8), [{ timeGroup: "morning" }], "Asia/Seoul")).toBe("morning");
  });

  it("handles a DST-shifting configured timezone using Intl", () => {
    const instant = new Date("2026-07-19T13:00:00Z");
    expect(currentTimeGroup(instant, "America/Los_Angeles")).toBe("morning");
  });
  it("does not resolve a fresh member until the cloud snapshot and today entries exist", () => {
    const state = { hydrated: false };
    const snapshot = {
      day: "2026-11-19",
      history: {} as Record<string, never[]>,
      state,
    };
    expect(startupDataReady(false, snapshot)).toBe(true);
    expect(startupDataReady(true, snapshot)).toBe(false);
    state.hydrated = true;
    expect(startupDataReady(true, snapshot)).toBe(false);
    snapshot.history["2026-11-19"] = [];
    expect(startupDataReady(true, snapshot)).toBe(true);
  });

});
