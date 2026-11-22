import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repairGuestReminders } from "../notifications/guest-reminder-repair.js";
import { buildScopedReminderPlan } from "../notifications/scoped-reminder-runtime.js";
import { toNativeNotification } from "../notifications/reminder-plan.js";
const now=new Date(2026,10,20,8);
const snap=(changes={})=>({day:"2026-11-20",habits:[{id:"walk",title:"산책",completed:false,alarmEnabled:true,scheduledTime:"09:00",repeatDays:[0,1,2,3,4,5,6],...changes}]});
const planned=(s=snap())=>buildScopedReminderPlan(s,{scope:"guest",now,daysAhead:8}).notifications.map(x=>toNativeNotification(x,"guest"));
function fake(items=[],display="granted"){
 let queue=[...items];const calls=[];
 return {calls,get queue(){return queue;},
 async checkPermissions(){calls.push("permission");return {display};},
 async getPending(){calls.push("pending");return {notifications:[...queue]};},
 async createChannel(){calls.push("channel");},
 async cancel({notifications}){calls.push("cancel");const ids=new Set(notifications.map(x=>x.id));queue=queue.filter(x=>!ids.has(x.id));},
 async schedule({notifications}){calls.push("schedule");queue.push(...notifications);}
 };
}
const run=(native,snapshot=snap(),optIn=true)=>repairGuestReminders({localNotifications:native,snapshot,optIn,now});
test("explicit opt-out never changes pending native state",async()=>{
 const native=fake(planned());assert.equal((await run(native,snap(),false)).status,"disabled");
 assert.equal(native.queue.length,8);assert.deepEqual(native.calls,[]);
});
test("stale or absent snapshot safely preserves old queue",async()=>{
 const native=fake(planned());
 assert.equal((await run(native,{day:"2026-11-19",habits:[]})).status,"snapshot-not-ready");
 assert.equal((await run(native,null)).status,"snapshot-not-ready");
 assert.deepEqual(native.calls,[]);
});
test("permission refused does not schedule or display automatic OS prompt",async()=>{
 const native=fake([],"denied");assert.equal((await run(native)).status,"permission-required");
 assert.deepEqual(native.calls,["permission"]);
});
test("missing alarm repaired, unrelated kept and second pass idempotent",async()=>{
 const plannedQueue=planned();const native=fake([...plannedQueue.slice(1),{id:7301,extra:{kind:"other"}}]);
 const result=await run(native);assert.equal(result.status,"repaired");
 assert.equal(result.added,1);assert.equal(result.cancelled,0);
 assert.equal((await run(native)).status,"already-synced");
 assert.equal(native.queue.length,9);assert.equal(native.queue.some(x=>x.id===7301),true);
});
test("time edits replace, completing today cancels one without touching foreign",async()=>{
 const native=fake([...planned(),{id:7301,extra:{kind:"other"}}]);
 const edited=await run(native,snap({scheduledTime:"09:05"}));
 assert.equal(edited.added,8);assert.equal(edited.cancelled,8);
 const completed=await run(native,snap({scheduledTime:"09:05",completed:true}));
 assert.equal(completed.added,0);assert.equal(completed.cancelled,1);
 assert.equal(native.queue.length,8);assert.equal(native.queue.some(x=>x.id===7301),true);
});
test("foreign ID collision prevents any native modification",async()=>{
 const id=planned()[0].id;const native=fake([{id,extra:{kind:"other",scope:"member:foreign"}}]);
 await assert.rejects(()=>run(native),/충돌/);
 assert.equal(native.calls.includes("schedule"),false);assert.equal(native.calls.includes("cancel"),false);
});
test("repair only exposed after audit mismatch in guest Android UI",()=>{
 const root=resolve(import.meta.dirname,"../..");
 const main=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
 const settings=readFileSync(resolve(root,"components/account/account-panel.tsx"),"utf8");
 const web=readFileSync(resolve(root,"app/page.tsx"),"utf8");
 assert.match(main,/canManuallyRepairGuestReminders\(report, effectiveHabitReminderOptIn\(enabledRef\.current, snapshot\.current\) \|\| hasEnabledWrapup\(wrapupRef\.current\), permissions\.display\)/);
 assert.match(main,/repairGuestReminders\(\{/);
 assert.match(settings,/nativeReminders\.repairAvailable &&/);
  assert.ok(settings.includes('runOnce("repair-reminders", nativeReminders.onRepairPending)'));
  assert.match(settings,/aria-busy={workingAction === "repair-reminders"}/);
  assert.ok(settings.includes('disabled={app.busy || nativeReminders.busy || workingAction !== null}'));
 assert.doesNotMatch(web,/onRepairPending|repairGuestReminders/);
});
