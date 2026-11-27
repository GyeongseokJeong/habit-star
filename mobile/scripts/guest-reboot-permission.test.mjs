import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateNotificationManifest, validateColdReminderProcessManifest } from "./check-guest-boot-manifest.mjs";
import { createReminderLifecycle } from "../notifications/reminder-lifecycle.js";
import { guestReminderAction } from "../notifications/guest-reminder-readiness.js";

const time = new Date(2026,10,20,8,0);
const snapshot = () => ({
  day:"2026-11-20",
  habits:[{
    id:"habit-boot-test", title:"재부팅 검증", completed:false,
    alarmEnabled:true, scheduledTime:"09:00", repeatDays:[0,1,2,3,4,5,6],
  }],
});
const context = (optIn=true) => ({
  optIn,identity:{kind:"guest",verified:true},snapshot:snapshot(),
});
function fakeNative() {
  let display="granted", queue=[];
  const calls=[];
  return {
    calls,
    async getPending(){calls.push("get");return {notifications:[...queue]};},
    async checkPermissions(){calls.push("check");return {display};},
    async createChannel(){calls.push("channel");},
    async schedule({notifications}){calls.push("schedule");queue.push(...notifications);},
    async cancel({notifications}){calls.push("cancel");const ids=new Set(notifications.map(n=>n.id));queue=queue.filter(n=>!ids.has(n.id));},
    permission(value){display=value;},
    reboot({preserve=true}={}){if (!preserve) queue=[];},
    get pending(){return [...queue];},
  };
}

test("final APK manifest requires Android boot restore and notification permissions",()=>{
  const tree=[
    "E: manifest",
    '  E: uses-permission A: android:name="android.permission.RECEIVE_BOOT_COMPLETED"',
    '  E: uses-permission A: android:name="android.permission.POST_NOTIFICATIONS"',
    '  E: uses-permission A: android:name="android.permission.SCHEDULE_EXACT_ALARM"',
    "  E: application",
    "    E: receiver",
    '      A: android:name="com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver"',
    "      E: intent-filter",
    '        E: action A: android:name="android.intent.action.LOCKED_BOOT_COMPLETED"',
    '        E: action A: android:name="android.intent.action.BOOT_COMPLETED"',
  ].join("\n");
  assert.equal(validateNotificationManifest(tree),true);
  assert.throws(()=>validateNotificationManifest(tree.replace("android.intent.action.BOOT_COMPLETED","android.intent.action.NOT_BOOT")),/device reboot action/);
  assert.throws(()=>validateNotificationManifest(tree.replace("android.permission.RECEIVE_BOOT_COMPLETED","android.permission.NOT_BOOT")),/boot completed permission/);
  assert.throws(()=>validateNotificationManifest(tree.replace("LocalNotificationRestoreReceiver","WrongReceiver")),/boot restore receiver/);
});

test("cold alarm components cannot move into a second process",()=>{
  const tree=["E: manifest","  E: application",
    ...["activity MainActivity","receiver ByeolharuWidgetProvider$Compact",
      "receiver TimedNotificationPublisher","receiver NotificationDismissReceiver",
      "receiver LocalNotificationRestoreReceiver"].flatMap(value=>{
        const [kind,name]=value.split(" ");
        return ["    E: "+kind,'      A: android:name="'+name+'"'];
      }),
  ].join("\n");
  assert.equal(validateColdReminderProcessManifest(tree),true);
  assert.throws(()=>validateColdReminderProcessManifest(tree.replace('A: android:name="TimedNotificationPublisher"',
    'A: android:name="TimedNotificationPublisher"\n      A: android:process(0x01010011)=":other"')),/application process/);
  assert.throws(()=>validateColdReminderProcessManifest(tree.replace('E: application','E: application\n    A: android:process=":other"')),/application process/);
  assert.throws(()=>validateColdReminderProcessManifest(tree.replace("NotificationDismissReceiver","MissingReceiver")),/component missing/);
});

test("simulated restart preserves restored queue without creating duplicate alarms",async()=>{
  const native=fakeNative(), lifecycle=createReminderLifecycle({localNotifications:native,now:()=>time});
  assert.equal((await lifecycle.sync(context())).status,"updated");
  assert.equal(native.pending.length,8);
  native.reboot({preserve:true});
  assert.equal((await lifecycle.onForeground(context())).status,"unchanged");
  assert.equal(native.pending.length,8);
  assert.equal(native.calls.filter(x=>x==="schedule").length,1);
});

test("simulated reboot queue loss rehydrates only missing guest alarms on next foreground",async()=>{
  const native=fakeNative(), lifecycle=createReminderLifecycle({localNotifications:native,now:()=>time});
  await lifecycle.sync(context());
  native.reboot({preserve:false});
  assert.equal(native.pending.length,0);
  assert.equal(guestReminderAction(true,snapshot(),time),"sync");
  assert.equal((await lifecycle.onForeground(context())).status,"updated");
  assert.equal(native.pending.length,8);
});

test("permission revoked and granted again: never automatically prompt or write while blocked",async()=>{
  const native=fakeNative(), lifecycle=createReminderLifecycle({localNotifications:native,now:()=>time});
  await lifecycle.sync(context());
  native.permission("denied");
  native.reboot({preserve:false});
  const count=native.calls.length;
  assert.equal((await lifecycle.onForeground(context())).status,"permission-required");
  assert.equal(native.pending.length,0);
  assert.equal(native.calls.slice(count).includes("schedule"),false);
  assert.equal(native.calls.includes("requestPermissions"),false);
  native.permission("granted");
  assert.equal((await lifecycle.onForeground(context())).status,"updated");
  assert.equal(native.pending.length,8);
});

test("explicit opt-out wins over boot recovery even after permission re-grant",async()=>{
  const native=fakeNative(), lifecycle=createReminderLifecycle({localNotifications:native,now:()=>time});
  await lifecycle.sync(context());
  await lifecycle.disable();
  assert.equal(native.pending.length,0);
  native.reboot({preserve:false});
  native.permission("denied");
  native.permission("granted");
  assert.equal((await lifecycle.onForeground(context(false))).status,"disabled");
  assert.equal(native.pending.length,0);
});

test("incomplete and previous-day snapshots must defer reconciliation while opening after reboot",()=>{
  assert.equal(guestReminderAction(true,null,time),"await-snapshot");
  assert.equal(guestReminderAction(true,{...snapshot(),day:"2026-11-19"},time),"await-today");
  assert.equal(guestReminderAction(false,null,time),"disable");
});

test("app resume refreshes repository before the Android reminder lifecycle runs",()=>{
  const root=resolve(import.meta.dirname,"../..");
  const entry=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
  const store=readFileSync(resolve(root,"lib/habits/use-habit-app.ts"),"utf8");
  assert.match(entry,/App\.addListener\("appStateChange"/);
  assert.match(entry,/window\.dispatchEvent\(new Event\("byeolharu:native-resume"\)\)/);
  assert.match(store,/await r\.ensureDay\(\);\s*await refresh\(r\)/);
  assert.match(entry,/if \(action === "await-snapshot" \|\| action === "await-today"\)/);
});
