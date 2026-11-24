import test from "node:test";
import assert from "node:assert/strict";
import {
  buildScopedReminderPlan,
  requireReminderScope,
  diffScopedNotifications,
  reconcileScopedReminders,
  cancelScopedReminders,
} from "../notifications/scoped-reminder-runtime.js";
import { toNativeNotification, REMINDER_KIND } from "../notifications/reminder-plan.js";

const now = new Date(2026, 10, 20, 8, 0);
const scope = "member:account_1234";
const habit = (changes={}) => ({
  id: "water", title: "물 마시기", completed: false,
  alarmEnabled: true, scheduledTime: "09:00",
  repeatDays: [0,1,2,3,4,5,6],
  ...changes,
});
const snapshot = (habits=[habit()], day="2026-11-20") => ({day, habits});
const plan = (h=[habit()], accountScope=scope) =>
  buildScopedReminderPlan(snapshot(h), { scope: accountScope, now, daysAhead:2 });

function fakeNative(initial=[], display="granted") {
  const calls=[];
  let pending=[...initial];
  return {
    calls,
    async checkPermissions() { calls.push("check"); return { display }; },
    async getPending() { calls.push("getPending"); return {notifications:[...pending]}; },
    async createChannel(options) { calls.push("channel"); assert.ok(options.id); },
    async cancel({notifications}) {
      calls.push("cancel");
      const ids=new Set(notifications.map(n=>n.id));
      pending=pending.filter(item=>!ids.has(item.id));
    },
    async schedule({notifications}) {
      calls.push("schedule");
      pending=[...pending,...notifications];
    },
    get value() { return [...pending]; },
  };
}

test("valid verified local scopes and fail-closed stale snapshots", () => {
  assert.equal(requireReminderScope("guest"),"guest");
  assert.equal(requireReminderScope("member:uuid-123"),"member:uuid-123");
  for(const bad of ["","member:","admin","member:some name",null]) {
    assert.throws(()=>requireReminderScope(bad));
  }
  assert.throws(()=>buildScopedReminderPlan(null,{scope,now}));
  assert.throws(()=>buildScopedReminderPlan(snapshot([habit()],"2026-11-19"),{scope,now}));
  assert.throws(()=>buildScopedReminderPlan({day:"2026-11-20",habits:null},{scope,now}));
});

test("reminder IDs are identity-specific and completion only skips today", () => {
  const member=plan();
  const guest=plan([habit()],"guest");
  assert.notEqual(member.notifications[0].id,guest.notifications[0].id);
  assert.equal(member.notifications[0].day,"2026-11-20");
  const completed=plan([habit({completed:true})]);
  assert.equal(completed.notifications.length,1);
  assert.equal(completed.notifications[0].day,"2026-11-21");
  // Editing a daily rating alone must not mark the habit completed.
  assert.equal(plan([habit({completed:false,rating:5})]).notifications.length,2);
});

test("diff preserves unrelated and unchanged reservations without duplicate work", () => {
  const ownPlan=plan();
  const unchanged=ownPlan.notifications.map(item=>toNativeNotification(item,scope));
  const other={id:7301,extra:{kind:"step4",scope:"different"}};
  const diff=diffScopedNotifications([...unchanged,other],ownPlan);
  assert.equal(diff.cancel.length,0);
  assert.equal(diff.schedule.length,0);
  assert.equal(diff.unchanged,2);
  assert.equal(diff.desiredCount,2);
});

test("delivery policy update replaces old pending alarms without changing IDs or other scopes", () => {
  const desired=plan();
  const old=desired.notifications.map(item=>{
    const n=toNativeNotification(item,scope);
    return {...n, schedule:{at:item.at,allowWhileIdle:false},extra:{...n.extra,fingerprint:"old-policy:"+n.extra.fingerprint}};
  });
  const unrelated={id:7301,extra:{kind:"unrelated"}};
  const diff=diffScopedNotifications([...old,unrelated],desired);
  assert.deepEqual(diff.cancel.map(n=>n.id),old.map(n=>n.id));
  assert.deepEqual(diff.schedule.map(n=>n.id),old.map(n=>n.id));
  assert.ok(diff.schedule.every(n=>n.schedule.allowWhileIdle===true && n.isExactNotification===false));
  assert.equal(diffScopedNotifications([...diff.schedule,unrelated],desired).schedule.length,0);
});
test("exact alarm permission changes reservations without changing notification IDs", async () => {
  const native=fakeNative();
  native.checkExactNotificationSetting=async()=>({exact_alarm:"granted"});
  const first=await reconcileScopedReminders(native,plan());
  assert.equal(first.exactPermission,"granted");
  assert.ok(first.schedule.every(item=>item.isExactNotification===true));
  native.checkExactNotificationSetting=async()=>({exact_alarm:"denied"});
  const second=await reconcileScopedReminders(native,plan());
  assert.equal(second.exactPermission,"denied");
  assert.equal(second.cancel.length,2);
  assert.ok(second.schedule.every(item=>item.isExactNotification===false));
});
test("edited time changes fingerprint; disabling removes only owned jobs", () => {
  const oldPlan=plan();
  const old=oldPlan.notifications.map(item=>toNativeNotification(item,scope));
  const other={id:7301,extra:{kind:"step4"}};
  const changedPlan=plan([habit({scheduledTime:"09:05"})]);
  const diff=diffScopedNotifications([...old,other],changedPlan);
  assert.equal(diff.cancel.length,2);
  assert.equal(diff.schedule.length,2);
  assert.equal(diff.cancel.every(({id})=>id!==7301),true);
  const disabled=plan([habit({alarmEnabled:false})]);
  const removed=diffScopedNotifications([...old,other],disabled);
  assert.equal(removed.cancel.length,2);
  assert.equal(removed.schedule.length,0);
});

test("foreign ID collision and duplicate IDs reject before effects", () => {
  const wanted=plan();
  const conflict={id:wanted.notifications[0].id,extra:{kind:REMINDER_KIND,scope:"guest"}};
  assert.throws(()=>diffScopedNotifications([conflict],wanted),/충돌/);
  const own=toNativeNotification(wanted.notifications[0],scope);
  assert.throws(()=>diffScopedNotifications([own,own],wanted),/중복/);
});

test("native adapter never silently requests permission", async () => {
  const fake=fakeNative([],"denied");
  const result=await reconcileScopedReminders(fake,plan());
  assert.equal(result.status,"permission-required");
  assert.deepEqual(fake.calls,["check"]);
});

test("native adapter schedules once, remains idempotent and updates changes", async () => {
  const native=fakeNative([{id:7301,extra:{kind:"step4"}}]);
  const first=await reconcileScopedReminders(native,plan());
  assert.equal(first.status,"updated");
  assert.equal(first.schedule.length,2);
  const second=await reconcileScopedReminders(native,plan());
  assert.equal(second.status,"unchanged");
  assert.equal(native.calls.filter(c=>c==="schedule").length,1);
  const third=await reconcileScopedReminders(native,plan([habit({completed:true})]));
  assert.equal(third.cancel.length,1);
  assert.equal(third.schedule.length,0);
  assert.equal(native.value.some(n=>n.id===7301),true);
});

test("explicit account switch cancels only the old account reminders", async () => {
  const own=plan().notifications.map(item=>toNativeNotification(item,scope));
  const guest=plan([habit()],"guest").notifications.map(item=>toNativeNotification(item,"guest"));
  const native=fakeNative([...own,...guest,{id:7301,extra:{kind:"step4"}}]);
  const removed=await cancelScopedReminders(native,scope);
  assert.equal(removed,2);
  assert.equal(native.value.length,3);
  assert.equal(native.value.filter(n=>n.extra?.scope==="guest").length,2);
  assert.equal(await cancelScopedReminders(native,scope),0);
});
