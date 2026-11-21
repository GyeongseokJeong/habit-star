import test from "node:test";
import assert from "node:assert/strict";
import { guestReminderAction } from "../notifications/guest-reminder-readiness.js";

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
