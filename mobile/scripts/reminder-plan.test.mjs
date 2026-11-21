import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReminderPlan, reminderId, toNativeNotification, DEMO_SCOPE, MAX_REMINDERS,
} from "../notifications/reminder-plan.js";

const mk = (overrides={}) => ({
  id:"water",title:"물 마시기",alarmEnabled:true,
  scheduledTime:"09:00",repeatDays:[0,1,2,3,4,5,6], ...overrides,
});
const now = new Date(2026, 10, 20, 8, 0, 0);
test("repeat days use local JS weekday and do not schedule past times", () => {
  const fri=buildReminderPlan([mk({repeatDays:[5]})],{now,daysAhead:8});
  assert.equal(fri.total,2);
  assert.equal(fri.notifications[0].day,"2026-11-20");
  assert.equal(fri.notifications[1].day,"2026-11-27");
  const late=buildReminderPlan([mk()],{now:new Date(2026,10,20,10),daysAhead:1});
  assert.equal(late.total,0);
});
test("completion suppresses only today's one-shot reminder", () => {
  const result=buildReminderPlan([mk()],{now,daysAhead:2,completedTodayIds:["water"]});
  assert.equal(result.total,1);
  assert.equal(result.notifications[0].day,"2026-11-21");
});
test("disabled, unscheduled and excluded weekday habits yield none", () => {
  const result=buildReminderPlan([
    mk({id:"a",alarmEnabled:false}),
    mk({id:"b",scheduledTime:undefined}),
    mk({id:"c",repeatDays:[1]}),
  ],{now,daysAhead:1});
  assert.equal(result.total,0);
});
test("invalid data fails closed before any scheduling", () => {
  for(const item of [
    mk({repeatDays:[]}),mk({repeatDays:[7]}),mk({repeatDays:[1,1]}),
    mk({scheduledTime:"25:00"}),mk({scheduledTime:"09:99"}),
    mk({id:""}),mk({alarmEnabled:undefined}),
  ]) assert.throws(()=>buildReminderPlan([item],{now}));
  assert.throws(()=>buildReminderPlan([mk(),mk()],{now}));
  assert.throws(()=>buildReminderPlan([mk()],{now,daysAhead:99}));
});
test("bounded queue and stable IDs; payload carries owned metadata", () => {
  const habits=Array.from({length:10},(_,i)=>mk({id:"habit-"+i}));
  const result=buildReminderPlan(habits,{now,daysAhead:8});
  assert.ok(result.truncated);
  assert.equal(result.notifications.length,MAX_REMINDERS);
  assert.equal(result.total,80);
  const first=result.notifications[0];
  assert.equal(first.id,reminderId(first.habitId,first.day));
  assert.ok(first.id>=1_000_000_000 && first.id<1_900_000_000);
  const payload=toNativeNotification(first,DEMO_SCOPE);
  assert.equal(payload.extra.scope,DEMO_SCOPE);
  assert.equal(payload.extra.habitId,first.habitId);
  assert.equal(payload.schedule.allowWhileIdle,true);
  assert.equal(payload.isExactNotification,false);
  assert.equal(Object.hasOwn(payload.schedule,"isExactNotification"),false);
  assert.throws(()=>toNativeNotification(first,""));
});
test("same habit/day ID across updates; changed time has changed fingerprint", () => {
  const a=buildReminderPlan([mk()],{now,daysAhead:1}).notifications[0];
  const b=buildReminderPlan([mk({scheduledTime:"09:05"})],{now,daysAhead:1}).notifications[0];
  assert.equal(a.id,b.id);
  assert.notEqual(a.fingerprint,b.fingerprint);
});
