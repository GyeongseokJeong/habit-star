import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditGuestReminders } from "../notifications/guest-reminder-audit.js";
import { buildScopedReminderPlan } from "../notifications/scoped-reminder-runtime.js";
import { toNativeNotification, REMINDER_KIND } from "../notifications/reminder-plan.js";

const now = new Date(2026,10,20,8);
const habit = (changes={}) => ({
  id:"walk",title:"산책",completed:false,alarmEnabled:true,
  scheduledTime:"09:00",repeatDays:[0,1,2,3,4,5,6],...changes,
});
const snapshot = (h=habit()) => ({day:"2026-11-20",habits:[h]});
const planned = (s=snapshot()) => buildScopedReminderPlan(s,{scope:"guest",now,daysAhead:8}).notifications.map(n=>toNativeNotification(n,"guest"));
const audit = (s,pending,optIn=true,permission="granted") => auditGuestReminders({
  snapshot:s,optIn,pending,permission,now,
});

test("exact planned queue passes, unrelated notifications do not count",()=>{
  const q=planned();
  const foreign={id:7301,extra:{kind:"unrelated",scope:"guest"}};
  const result=audit(snapshot(),[...q,foreign]);
  assert.equal(result.status,"synced");
  assert.equal(result.expectedCount,8);
  assert.equal(result.actualCount,8);
  assert.equal(result.missingCount,0);
  assert.equal(result.staleCount,0);
});
test("missing, stale and revised notifications are detected, never rescheduled",()=>{
  const queue=planned();
  const copy=JSON.stringify(queue);
  const oneMissing=audit(snapshot(),queue.slice(1));
  assert.equal(oneMissing.status,"out-of-sync");
  assert.equal(oneMissing.missingCount,1);
  assert.equal(oneMissing.staleCount,0);
  const revised=audit(snapshot(habit({scheduledTime:"09:05"})),queue);
  assert.equal(revised.status,"out-of-sync");
  assert.equal(revised.missingCount,8);
  assert.equal(revised.staleCount,8);
  assert.equal(JSON.stringify(queue),copy);
});
test("completed today requires only tomorrow onward, and disabled habits schedule none",()=>{
  const queue=planned();
  const completed=audit(snapshot(habit({completed:true})),queue);
  assert.equal(completed.expectedCount,7);
  assert.equal(completed.staleCount,1);
  assert.equal(completed.missingCount,0);
  const off=audit(snapshot(habit({alarmEnabled:false})),queue);
  assert.equal(off.expectedCount,0);
  assert.equal(off.staleCount,8);
});
test("opt-out reports lingering jobs and no pending is clean",()=>{
  const queue=planned();
  assert.equal(audit(null,queue,false).status,"unexpected-pending");
  assert.equal(audit(null,[],false).status,"disabled");
  assert.equal(audit(null,queue,false).staleCount,8);
});
test("denied permission and incomplete snapshot are reported without guessing expected count",()=>{
  const denied=audit(snapshot(),planned(),true,"denied");
  assert.equal(denied.status,"permission-required");
  assert.equal(denied.expectedCount,null);
  const stale=audit({day:"2026-11-19",habits:[habit()]},planned());
  assert.equal(stale.status,"snapshot-not-ready");
  assert.equal(stale.expectedCount,null);
  assert.throws(()=>auditGuestReminders({snapshot:snapshot(),optIn:true,pending:null,now}));
});
test("foreign guest notification ID conflict fails closed instead of editing anything",()=>{
  const queue=planned();
  queue[0]={id:queue[0].id,extra:{kind:REMINDER_KIND,scope:"member:somebody"}};
  assert.throws(()=>audit(snapshot(),queue),/충돌/);
});
test("Android-only UI has a read-only audit and website does not expose it",()=>{
  const root=resolve(import.meta.dirname,"../..");
  const entry=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
  const account=readFileSync(resolve(root,"components/account/account-panel.tsx"),"utf8");
  const web=readFileSync(resolve(root,"app/page.tsx"),"utf8");
  assert.match(entry,/auditGuestReminders\(\{/);
  assert.match(entry,/LocalNotifications\.getPending\(\)/);
  assert.match(account,/runOnce\("audit-reminders", nativeReminders\\.onAuditPending\)/);
  assert.match(account,/aria-busy={workingAction === "audit-reminders"}/);
  assert.match(account,/disabled={app\\.busy \\|\\| nativeReminders\\.busy \\|\\| workingAction !== null}/);
  assert.doesNotMatch(web,/onAuditPending|auditGuestReminders/);
});
