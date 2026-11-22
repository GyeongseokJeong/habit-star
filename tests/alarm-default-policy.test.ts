import { describe, expect, it } from "vitest";
import { alarmForSelectedTime } from "../lib/habits/alarm-default-policy";

const input = {
  isNewHabit: true,
  android: true,
  time: "07:30",
  current: false,
  userToggledAlarm: false,
};

describe("conditional Android habit reminder default", () => {
  it("opts into an alarm when a new habit's time was directly selected", () => {
    expect(alarmForSelectedTime(input)).toBe(true);
  });
  it("never opts in from a web-only time field", () => {
    expect(alarmForSelectedTime({ ...input, android: false })).toBe(false);
  });
  it("does not change an existing habit's selected alarm setting", () => {
    expect(alarmForSelectedTime({ ...input, isNewHabit: false })).toBe(false);
    expect(alarmForSelectedTime({ ...input, isNewHabit: false, current: true })).toBe(true);
  });
  it("honors a user-selected OFF even after another time change", () => {
    expect(alarmForSelectedTime({ ...input, userToggledAlarm: true })).toBe(false);
  });
  it("always turns the alarm off when its scheduled time is removed", () => {
    expect(alarmForSelectedTime({ ...input, time: "", current: true })).toBe(false);
  });
  it("keeps an explicit ON after changing the time", () => {
    expect(alarmForSelectedTime({ ...input, userToggledAlarm: true, current: true })).toBe(true);
  });
});
