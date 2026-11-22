import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createReminderLifecycle } from "../notifications/reminder-lifecycle.js";
import { effectiveHabitReminderOptIn, hasConfiguredHabitReminders } from "../notifications/habit-reminder-intent.js";
const now=()=>new Date("2026-11-19T23:00:00.000Z"); // 08:00 Asia/Seoul
const member={kind:"member",userId:"member-1",verified:true};
const guest={kind:"guest",verified:true};
const h=(changes={})=>({id:"water",title:"물 마시기",timeGroup:"morning",alarmEnabled:true,scheduledTime:"09:00",completed:false,repeatDays:[0,1,2,3,4,5,6],...changes});
const snap=(habits=[h()])=>({day:"2026-11-20",timeZone:"Asia/Seoul",habits});
function native(display="granted") {
 let queue=[];const calls=[];
 return {calls,get pending(){return queue;},
  async checkPermissions(){calls.push("permission");return {display};},
  async getPending(){return {notifications:queue.slice()};},
  async createChannel(){calls.push("channel");},
  async schedule({notifications}){calls.push("schedule");queue.push(...notifications);},
  async cancel({notifications}){calls.push("cancel");const ids=new Set(notifications.map(x=>x.id));queue=queue.filter(x=>!ids.has(x.id));},
  grant(){display="granted";}
 };
}
test("a signed-in existing habit triggers opt-in even when the fresh APK has no legacy setting",()=>{
 assert.equal(effectiveHabitReminderOptIn(null,snap()),true);
 assert.equal(effectiveHabitReminderOptIn(false,snap()),false);
 assert.equal(effectiveHabitReminderOptIn(true,snap([])),true);
 assert.equal(hasConfiguredHabitReminders(snap([h({alarmEnabled:false})])),false);
 assert.equal(hasConfiguredHabitReminders(snap([h({scheduledTime:undefined})])),false);
 assert.equal(hasConfiguredHabitReminders(snap([h({scheduledTime:"25:00"})])),false);
 assert.equal(effectiveHabitReminderOptIn(null,null),false);
 assert.equal(effectiveHabitReminderOptIn(null,snap([])),false);
});
test("existing member alarms automatically schedule and repeated reconciles remain idempotent",async()=>{
 const plugin=native(),lifecycle=createReminderLifecycle({localNotifications:plugin,now}),data=snap();
 const context={identity:member,snapshot:data,optIn:effectiveHabitReminderOptIn(null,data)};
 assert.equal((await lifecycle.sync(context)).status,"updated");
 assert.equal(plugin.pending.length,8);
 assert.ok(plugin.pending.every(x=>x.extra.scope==="member:member-1"));
 assert.equal((await lifecycle.sync(context)).status,"unchanged");
 assert.equal(plugin.calls.filter(x=>x==="schedule").length,1);
});
test("allowing OS notifications then returning to the app registers the existing habits",async()=>{
 const plugin=native("denied"),lifecycle=createReminderLifecycle({localNotifications:plugin,now}),data=snap();
 const context={identity:member,snapshot:data,optIn:effectiveHabitReminderOptIn(null,data)};
 assert.equal((await lifecycle.sync(context)).status,"permission-required");
 assert.equal(plugin.pending.length,0);
 plugin.grant();
 assert.equal((await lifecycle.onForeground(context)).status,"updated");
 assert.equal(plugin.pending.length,8);
});
test("member switch removes previous account's jobs, switching every habit OFF clears owned jobs",async()=>{
 const plugin=native(),lifecycle=createReminderLifecycle({localNotifications:plugin,now}),data=snap();
 await lifecycle.sync({identity:guest,snapshot:data,optIn:effectiveHabitReminderOptIn(null,data)});
 const move=await lifecycle.sync({identity:member,snapshot:data,optIn:effectiveHabitReminderOptIn(null,data)});
 assert.equal(move.cancelledOtherScopes,8);
 assert.equal(plugin.pending.filter(x=>x.extra.scope==="member:member-1").length,8);
 const off=snap([h({alarmEnabled:false})]);
 assert.equal((await lifecycle.sync({identity:member,snapshot:off,optIn:effectiveHabitReminderOptIn(null,off)})).status,"disabled");
 assert.equal(plugin.pending.length,0);
});
test("entrypoint reconnects after OS permission grant without requiring a habit edit",()=>{
 const path=resolve(import.meta.dirname,"../../mobile/packaged-guest/main.tsx");
 const entry=readFileSync(path,"utf8");
 assert.match(entry,/if \(granted && snapshot\.current\) \{/);
 assert.match(entry,/setHasHabitIntent\(hasConfiguredHabitReminders\(next\)\)/);
 assert.match(entry,/effectiveHabitReminderOptIn\(value, next\)/);
 assert.match(entry,/preference === "1" \? true : preference === "0" \? false : null/);
 assert.doesNotMatch(entry,/if \(!saved.*schedule\(false, null\)/);
});
