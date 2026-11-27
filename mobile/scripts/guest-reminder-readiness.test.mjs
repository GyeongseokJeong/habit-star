import test from "node:test";
import assert from "node:assert/strict";
import { guestReminderAction, isReminderSnapshotReady } from "../notifications/guest-reminder-readiness.js";

const now = new Date(2026, 10, 20, 8, 0, 0);
const today = { day: "2026-11-20", habits: [] };

test("missing or unloading guest snapshot must preserve existing Android alarms", () => {
  assert.equal(guestReminderAction(true, null, now), "await-snapshot");
  assert.equal(guestReminderAction(true, undefined, now), "await-snapshot");
  assert.equal(guestReminderAction(true, {day:"2026-11-20"}, now), "await-snapshot");
});
test("local midnight rollover waits for the newly loaded daily record", () => {
  assert.equal(guestReminderAction(true, {day:"2026-11-19", habits:[]}, now), "await-today");
  assert.equal(guestReminderAction(true, {day:"2026-11-21", habits:[]}, now), "await-today");
  assert.equal(guestReminderAction(true, today, now), "sync");
});
test("explicit guest opt-out cancels even with no repository snapshot", () => {
  assert.equal(guestReminderAction(false, null, now), "disable");
  assert.equal(guestReminderAction(false, {day:"2026-11-19"}, now), "disable");
});
test("invalid current clock fails closed", () => {
  assert.throws(()=>guestReminderAction(true,today,new Date(NaN)));
});

test("member readiness follows persisted account date across the date boundary",()=>{
  const instant=new Date("2026-11-21T01:00:00Z");
  assert.equal(guestReminderAction(true,{day:"2026-11-21",habits:[],timeZone:"Asia/Seoul"},instant),"sync");
  assert.equal(guestReminderAction(true,{day:"2026-11-20",habits:[],timeZone:"Asia/Seoul"},instant),"await-today");
  assert.equal(guestReminderAction(true,{day:"2026-11-20",habits:[],timeZone:"America/Los_Angeles"},instant),"sync");
});

const readySnapshot = (day, { hydrated = true, timezone = "Asia/Seoul", habits = [] } = {}) => ({
  day, habits, history: { [day]: habits }, state: { hydrated, timezone },
});

test("a fresh or interrupted member hydration cannot authorize automatic reminder reconciliation", () => {
  const instant = new Date("2026-11-20T08:00:00+09:00");
  const ready = readySnapshot("2026-11-20", {
    habits: [{ id: "example", alarmEnabled: true, scheduledTime: "20:00" }],
  });
  assert.equal(isReminderSnapshotReady(null, "member-a", instant), false);
  assert.equal(isReminderSnapshotReady(readySnapshot("2026-11-20", { hydrated: false }), "member-a", instant), false);
  assert.equal(isReminderSnapshotReady({ ...ready, state: { timezone: "Asia/Seoul" } }, "member-a", instant), false);
  assert.equal(isReminderSnapshotReady({ ...ready, history: {} }, "member-a", instant), false);
  assert.equal(isReminderSnapshotReady({ ...ready, habits: undefined }, "member-a", instant), false);
  assert.equal(isReminderSnapshotReady(ready, "member-a", instant), true);
  // An actually empty account is ready only once its current-day history is
  // confirmed, not simply because the initial snapshot happens to be empty.
  assert.equal(isReminderSnapshotReady(readySnapshot("2026-11-20"), "member-a", instant), true);
});

test("member restore uses persisted account timezone and rejects stale day or unknown timezone", () => {
  const instant = new Date("2026-11-21T01:00:00Z");
  const east = readySnapshot("2026-11-21", { timezone: "Asia/Seoul" });
  const west = readySnapshot("2026-11-20", { timezone: "America/Los_Angeles" });
  assert.equal(isReminderSnapshotReady(east, "member-a", instant), true);
  assert.equal(isReminderSnapshotReady(west, "member-a", instant), true);
  assert.equal(isReminderSnapshotReady(readySnapshot("2026-11-20"), "member-a", instant), false);
  assert.equal(isReminderSnapshotReady({ ...east, state: { hydrated: true } }, "member-a", instant), false);
  assert.equal(isReminderSnapshotReady({ ...east, state: { hydrated: true, timezone: "invalid/zone" } }, "member-a", instant), false);
  assert.equal(isReminderSnapshotReady(east, "member-a", new Date(NaN)), false);
});

test("guest readiness uses local date but still waits for a confirmed daily history", () => {
  const day = readySnapshot("2026-11-20", { hydrated: false, timezone: "America/Los_Angeles" });
  assert.equal(isReminderSnapshotReady(day, null, now), true);
  assert.equal(isReminderSnapshotReady({ ...day, history: { "2026-11-19": [] } }, null, now), false);
  assert.equal(isReminderSnapshotReady({ ...day, day: "2026-11-19" }, null, now), false);
  assert.equal(isReminderSnapshotReady({ ...day, history: Object.create({ "2026-11-20": [] }) }, null, now), false);
  assert.equal(isReminderSnapshotReady({ ...day, habits: null }, null, now), false);
  assert.equal(isReminderSnapshotReady(day, null, new Date(NaN)), false);
});
