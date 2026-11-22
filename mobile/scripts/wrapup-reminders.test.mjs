import test from "node:test";
import assert from "node:assert/strict";
import {
  WRAPUP_DEFAULTS, normalizeWrapupSettings, hasEnabledWrapup, buildWrapupCandidates,
} from "../notifications/wrapup-reminders.js";
import {
  buildScopedReminderPlan, diffScopedNotifications,
} from "../notifications/scoped-reminder-runtime.js";
import { toNativeNotification, MAX_REMINDERS } from "../notifications/reminder-plan.js";

const now = new Date(2026, 10, 20, 8);
const mk = (changes = {}) => ({
  id: "morning-water", title: "물 마시기", timeGroup: "morning",
  scheduledTime: "08:00", repeatDays: [0,1,2,3,4,5,6],
  alarmEnabled: true, completed: false, ...changes,
});
const setting = (group, time) => normalizeWrapupSettings({
  ...WRAPUP_DEFAULTS, [group]: { enabled: true, time },
});
const snapshot = (habits) => ({ day: "2026-11-20", habits });
const plan = (habits, settings, options = {}) => buildScopedReminderPlan(
  snapshot(habits), { scope: "guest", now, daysAhead: 2, wrapupSettings: settings, ...options },
);

test("default OFF and invalid saved values fail closed, never activating alarms", () => {
  const off = normalizeWrapupSettings();
  assert.deepEqual(off, {
    morning: { enabled: false, time: "10:30" },
    day: { enabled: false, time: "16:30" },
    night: { enabled: false, time: "22:00" },
  });
  assert.equal(hasEnabledWrapup(off), false);
  assert.equal(buildWrapupCandidates(snapshot([mk()]), { now, daysAhead: 1 }, off).length, 0);
  const malformed = normalizeWrapupSettings({
    morning: { enabled: true, time: "03:00" },
    day: { enabled: "true", time: "16:30" },
    night: { enabled: true, time: "22:00" },
  });
  assert.equal(malformed.morning.enabled, false);
  assert.equal(malformed.day.enabled, false);
  assert.equal(malformed.night.enabled, true);
});

test("at most one period summary per day, regardless of the number of eligible habits", () => {
  const habits = Array.from({ length: 17 }, (_, i) => mk({ id: "h-" + i }));
  const out = buildWrapupCandidates(snapshot(habits), { now, daysAhead: 1 }, setting("morning", "10:30"));
  assert.equal(out.length, 1);
  assert.equal(out[0].remainingCount, 17);
  assert.equal(out[0].timeGroup, "morning");
  const native = toNativeNotification(out[0], "guest");
  assert.match(native.body, /17개/);
  assert.equal(native.extra.category, "wrapup");
  assert.equal(native.extra.timeGroup, "morning");
  assert.equal(native.extra.scope, "guest");
  assert.equal(native.isExactNotification, false);
});

test("only opted-in, scheduled and still unfinished habits before the wrap-up time count", () => {
  const habits = [
    mk({ id: "done", completed: true }),
    mk({ id: "opt-out", alarmEnabled: false }),
    mk({ id: "not-yet", scheduledTime: "10:30" }),
    mk({ id: "later", scheduledTime: "10:45" }),
    mk({ id: "other", timeGroup: "day" }),
    mk({ id: "no-time", scheduledTime: undefined }),
    mk({ id: "weekday", repeatDays: [1] }),
    mk({ id: "eligible" }),
  ];
  const out = buildWrapupCandidates(snapshot(habits), { now, daysAhead: 1 }, setting("morning","10:30"));
  assert.equal(out.length, 1);
  assert.equal(out[0].remainingCount, 1);
  assert.equal(out[0].day, "2026-11-20");
});

test("all completed or no eligible weekday cancels today's wrap-up but future days remain", () => {
  const one = mk({ completed: true });
  const out = buildWrapupCandidates(snapshot([one]), { now, daysAhead: 2 }, setting("morning","10:30"));
  assert.equal(out.length, 1);
  assert.equal(out[0].day, "2026-11-21");
  const friOnly = mk({ repeatDays: [5] });
  const friday = buildWrapupCandidates(snapshot([friOnly]), { now, daysAhead: 2 }, setting("morning","10:30"));
  assert.equal(friday.length, 1);
  assert.equal(friday[0].day, "2026-11-20");
});

test("morning, day, night have independent switches and times; night is before sleep", () => {
  const habits = [
    mk(),
    mk({id:"day-reading", timeGroup:"day", scheduledTime:"13:00"}),
    mk({id:"night-reading", timeGroup:"night",scheduledTime:"21:00"}),
  ];
  const settings = normalizeWrapupSettings({
    morning: { enabled: false, time: "10:30" },
    day: { enabled: true, time: "16:00" },
    night: { enabled: true, time: "22:00" },
  });
  const out = buildWrapupCandidates(snapshot(habits), { now, daysAhead: 1 }, settings);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(x=>x.timeGroup),["day","night"]);
  assert.deepEqual(out.map(x=>x.at.getHours()),[16,22]);
});

test("member timezone controls clock and weekday, not the Android device's timezone", () => {
  const instant = new Date("2026-11-20T23:40:00.000Z");
  const memberSnapshot = {
    day: "2026-11-21", timeZone: "Asia/Seoul",
    habits: [mk({ repeatDays:[6] })],
  };
  const p = buildScopedReminderPlan(memberSnapshot, {
    scope:"member:user123", now:instant, daysAhead:1,
    habitOptIn:false, wrapupSettings:setting("morning","10:30"),
  });
  assert.equal(p.notifications.length,1);
  assert.equal(p.notifications[0].at.toISOString(),"2026-11-21T01:30:00.000Z");
  assert.equal(p.notifications[0].day,"2026-11-21");
});

test("near wrap-ups share the existing cap with habit reminders; never exceed 48", () => {
  const habits = Array.from({length:12},(_,i) => mk({id:"habit-"+i}));
  const wanted = plan(habits,setting("morning","10:30"), {daysAhead:8});
  assert.equal(wanted.notifications.length,MAX_REMINDERS);
  assert.equal(wanted.truncated,true);
  assert.ok(wanted.notifications.some(item=>item.category==="wrapup" && item.day==="2026-11-20"));
  assert.ok(wanted.notifications.every(item=>item.at >= now));
  assert.equal(new Set(wanted.notifications.map(item=>item.id)).size,wanted.notifications.length);
});

test("disabling group or completing last task cancels existing wrap-up, but not owned habit or foreign scope", () => {
  const active = plan([mk()],setting("morning","10:30"));
  const native = active.notifications.map(x=>toNativeNotification(x,"guest"));
  assert.equal(native.filter(x=>x.extra.category==="wrapup").length,2);
  const disabled=plan([mk()],WRAPUP_DEFAULTS);
  const diff=diffScopedNotifications([...native,{id:7301,extra:{scope:"other"}}],disabled);
  assert.equal(diff.cancel.length,2);
  assert.equal(diff.schedule.length,0);
  const complete=plan([mk({completed:true})],setting("morning","10:30"));
  const diff2=diffScopedNotifications(native,complete);
  assert.equal(diff2.cancel.length,1); // Today's habit alarm was already past; only the wrap-up remains to cancel.
  assert.equal(diff2.schedule.length,0);
});

test("wrap-up reservation IDs and owner metadata are isolated across member and guest scopes", () => {
  const settings=setting("morning","10:30");
  const guest=plan([mk()],settings);
  const member=buildScopedReminderPlan(snapshot([mk()]),{scope:"member:one",now,daysAhead:2,wrapupSettings:settings});
  assert.notEqual(guest.notifications.find(x=>x.category==="wrapup").id,member.notifications.find(x=>x.category==="wrapup").id);
  const intruder=toNativeNotification(member.notifications[0],"member:one");
  const expected=guest.notifications.find(x=>x.category==="wrapup");
  assert.equal(toNativeNotification(expected,"guest").extra.scope,"guest");
  assert.ok(diffScopedNotifications([intruder],guest).cancel.length===0);
});
