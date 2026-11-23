import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { summarizeGuestPending } from "../notifications/guest-reminder-diagnostics.js";
import { REMINDER_KIND } from "../notifications/reminder-plan.js";

const now = new Date(2026,10,20,8,0);
function notification(id,at,scope="guest",kind=REMINDER_KIND){
  return {id,schedule:{at},extra:{scope,kind}};
}
test("diagnostics are guest-only, read-only and report today's future alarms",()=>{
  const queue=[
    notification(1,new Date(2026,10,20,9)),
    notification(2,new Date(2026,10,21,9)),
    notification(3,new Date(2026,10,20,7)),
    notification(4,new Date(2026,10,20,10),"member:other"),
    notification(5,new Date(2026,10,20,11),"guest","other-kind"),
  ];
  const before=JSON.stringify(queue);
  const result=summarizeGuestPending(queue,now);
  assert.equal(result.total,3);
  assert.equal(result.todayRemaining,1);
  assert.equal(result.nextAt,new Date(2026,10,20,9).toISOString());
  assert.equal(result.unknownTime,0);
  assert.equal(JSON.stringify(queue),before);
});
test("member inspection uses exactly the current verified scope",()=>{
  const queue=[
    notification(11,new Date(2026,10,20,9),"member:user-one"),
    notification(12,new Date(2026,10,20,10),"guest"),
    notification(13,new Date(2026,10,21,9),"member:user-two"),
  ];
  const report=summarizeGuestPending(queue,now,"member:user-one");
  assert.equal(report.total,1);
  assert.equal(report.todayRemaining,1);
  assert.equal(report.nextAt,new Date(2026,10,20,9).toISOString());
  assert.throws(()=>summarizeGuestPending(queue,now,"member:../bad"));
});
test("missing native timestamps are reported as unknown, not invented",()=>{
  const result=summarizeGuestPending([{id:1,extra:{kind:REMINDER_KIND,scope:"guest"}}],now);
  assert.equal(result.total,1);
  assert.equal(result.todayRemaining,0);
  assert.equal(result.nextAt,null);
  assert.equal(result.unknownTime,1);
});
test("invalid inputs fail closed",()=>{
  assert.throws(()=>summarizeGuestPending(null,now));
  assert.throws(()=>summarizeGuestPending([],new Date(NaN)));
});
test("Android diagnostics engine remains native-only without developer buttons in public settings",()=>{
  const root=resolve(import.meta.dirname,"../..");
  const entry=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
  const account=readFileSync(resolve(root,"components/account/account-panel.tsx"),"utf8");
  const website=readFileSync(resolve(root,"app/page.tsx"),"utf8");
  assert.match(entry,/summarizeGuestPending\(pending.notifications, new Date\(\), scope\)/);
  assert.match(entry,/LocalNotifications\.checkPermissions\(\)/);
  assert.match(entry,/LocalNotifications\.getPending\(\)/);
  assert.match(entry,/const onInspectPending = useCallback/);
  assert.match(entry,/onInspectPending, onAuditPending, onRepairPending/);
  assert.doesNotMatch(account,/onInspectPending|inspect-reminders|알림 문제 해결/);
  assert.match(account,/nativeReminders\.onRequestPermission\(\)/);
  assert.doesNotMatch(website,/LocalNotifications|onInspectPending|Capacitor/);
});
