import test from "node:test";
import assert from "node:assert/strict";
import { createReminderLifecycle } from "../notifications/reminder-lifecycle.js";
import { REMINDER_KIND, DEMO_SCOPE } from "../notifications/reminder-plan.js";

const now = () => new Date(2026,10,20,8,0,0);
const member = { kind: "member", userId: "user-123", verified: true };
const guest = { kind: "guest", verified: true };
const snapshot = (changes={}) => ({
  day:"2026-11-20",
  habits:[{
    id:"habit-1", title:"산책", alarmEnabled:true, completed:false,
    scheduledTime:"09:00", repeatDays:[0,1,2,3,4,5,6], ...changes,
  }],
});
function fakeNative(initial=[],permission="granted") {
  const calls=[];
  let pending = initial.map(item=>({...item}));
  return {
    calls,
    async getPending(){ calls.push("get"); return { notifications:[...pending] }; },
    async checkPermissions(){calls.push("permission");return {display:permission};},
    async createChannel(){calls.push("channel");},
    async cancel({notifications}){
      calls.push("cancel");
      const ids=new Set(notifications.map(x=>x.id));
      pending=pending.filter(x=>!ids.has(x.id));
    },
    async schedule({notifications}){
      calls.push("schedule");
      pending.push(...notifications);
    },
    get pending(){return [...pending];},
  };
}
const context = (identity=member,changes={})=>({
 identity, optIn:true, snapshot:snapshot(changes)
});
test("opt-in false never schedules; disables only managed app notifications",async()=>{
  const demo={id:7301,extra:{kind:"step4"}};
  const step5={id:9001,extra:{kind:REMINDER_KIND,scope:DEMO_SCOPE}};
  const existing={id:9002,extra:{kind:REMINDER_KIND,scope:"member:other"}};
  const native=fakeNative([demo,step5,existing]);
  const lifecycle=createReminderLifecycle({localNotifications:native,now});
  assert.equal((await lifecycle.sync(context())).status,"updated");
  assert.equal(native.pending.some(n=>n.id===9002),false);
  assert.equal(native.pending.some(n=>n.id===7301),true);
  assert.equal(native.pending.some(n=>n.id===9001),true);
  const disabled=await lifecycle.disable();
  assert.equal(disabled.status,"disabled");
  assert.equal(native.pending.length,2);
  assert.equal(native.calls.filter(x=>x==="schedule").length,1);
});
test("repeated foreground update is idempotent and completed task cancels today only",async()=>{
  const native=fakeNative();
  const app=createReminderLifecycle({localNotifications:native,now});
  assert.equal((await app.sync(context())).status,"updated");
  assert.equal((await app.onForeground(context())).status,"unchanged");
  assert.equal(native.calls.filter(x=>x==="schedule").length,1);
  const next=await app.sync(context(member,{completed:true}));
  assert.equal(next.status,"updated");
  assert.equal(next.cancel.length,1);
  assert.equal(native.pending.length,1);
  assert.ok(native.pending[0].extra.day==="2026-11-21");
});
test("user switch revokes old member jobs and keeps other software jobs",async()=>{
  const native=fakeNative([{id:7301,extra:{kind:"legacy"}}]);
  const lifecycle=createReminderLifecycle({localNotifications:native,now});
  await lifecycle.sync(context());
  const memberIds=native.pending.filter(n=>n.extra?.scope==="member:user-123").map(n=>n.id);
  assert.equal(memberIds.length,2);
  const result=await lifecycle.sync(context(guest));
  assert.equal(result.status,"updated");
  assert.equal(result.cancelledOtherScopes,2);
  assert.equal(native.pending.filter(n=>n.extra?.scope==="member:user-123").length,0);
  assert.equal(native.pending.filter(n=>n.extra?.scope==="guest").length,2);
  assert.equal(native.pending.filter(n=>n.id===7301).length,1);
});
test("unverified identity, stale dates and missing snapshots fail closed",async()=>{
  const native=fakeNative();
  const lifecycle=createReminderLifecycle({localNotifications:native,now});
  await lifecycle.sync(context());
  assert.equal((await lifecycle.sync(context({kind:"member",userId:"abc",verified:false}))).status,"identity-unverified");
  assert.equal(native.pending.length,0);
  await lifecycle.sync(context());
  assert.equal((await lifecycle.sync({...context(),snapshot:{...snapshot(),day:"2026-11-19"}})).status,"snapshot-not-ready");
  assert.equal(native.pending.length,0);
  assert.equal((await lifecycle.sync({...context(),snapshot:null})).status,"snapshot-not-ready");
});
test("permission denied does not prompt or schedule",async()=>{
  const native=fakeNative([],"denied");
  const result=await createReminderLifecycle({localNotifications:native,now}).sync(context());
  assert.equal(result.status,"permission-required");
  assert.equal(native.calls.includes("schedule"),false);
  assert.equal(native.calls.includes("requestPermissions"),false);
});
test("queued updates use latest snapshot, do not schedule obsolete work",async()=>{
  const native=fakeNative();
  const lifecycle=createReminderLifecycle({localNotifications:native,now});
  const a=lifecycle.sync(context());
  const b=lifecycle.sync(context(member,{alarmEnabled:false}));
  assert.equal((await a).status,"superseded");
  assert.equal((await b).status,"unchanged");
  assert.equal(native.calls.includes("schedule"),false);
});
test("snapshots are copied at enqueue time; caller mutation does not affect plans",async()=>{
  const native=fakeNative();
  const lifecycle=createReminderLifecycle({localNotifications:native,now});
  const data=context();
  const promise=lifecycle.sync(data);
  data.snapshot.habits[0].scheduledTime="01:00";
  data.snapshot.habits[0].repeatDays.length=0;
  const result=await promise;
  assert.equal(result.status,"updated");
  assert.equal(native.pending.length,2);
});
test("malformed native adapter refuses to initialize",()=>{
  assert.throws(()=>createReminderLifecycle({localNotifications:{}}));
});
