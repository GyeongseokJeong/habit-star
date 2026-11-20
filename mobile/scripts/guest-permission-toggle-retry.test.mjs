import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  reminderSwitchChecked,
  reminderSwitchNextAction,
  canManuallyRepairGuestReminders,
} from "../notifications/guest-reminder-switch-state.js";

const root=resolve(import.meta.dirname,"../..");
const entry=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
const account=readFileSync(resolve(root,"components/account/account-panel.tsx"),"utf8");
const native=readFileSync(resolve(root,"mobile/native/ByeolharuDeviceSettingsPlugin.java.template"),"utf8");
const patcher=readFileSync(resolve(root,"mobile/scripts/patch-android.mjs"),"utf8");
const publicWeb=readFileSync(resolve(root,"app/page.tsx"),"utf8");

test("visible Android reminder switch reflects actual OS ability, not only saved opt-in",()=>{
  assert.equal(reminderSwitchChecked(true,"granted"),true);
  assert.equal(reminderSwitchChecked(true,"denied"),false);
  assert.equal(reminderSwitchChecked(false,"granted"),false);
  assert.equal(reminderSwitchChecked(true,"unknown"),false);
  assert.equal(reminderSwitchNextAction(true,"denied"),true);
  assert.equal(reminderSwitchNextAction(false,"granted"),true);
  assert.equal(reminderSwitchNextAction(true,"granted"),false);
  assert.match(account,/aria-checked=\{nativeReminders\.active\}/);
  assert.match(account,/onEnabledChange\(!nativeReminders\.active\)/);
  assert.match(entry,/reminderSwitchChecked\(enabled, permissionState\)/);
  // Native preferences remain distinct from a momentary OS permission toggle.
  assert.match(entry,/localStorage\.setItem\(OPT_IN_KEY, next \? "1" : "0"\)/);
});
test("turning visible switch ON re-requests permission then opens Android settings if blocked",()=>{
  assert.match(entry,/LocalNotifications\.requestPermissions\(\)/);
  assert.match(entry,/if \(!granted\) \{/);
  assert.match(entry,/deviceSettings\.openNotificationSettings\(\)/);
  assert.match(native,/Settings\.ACTION_APP_NOTIFICATION_SETTINGS/);
  assert.match(native,/Settings\.EXTRA_APP_PACKAGE/);
  assert.match(native,/getContext\(\)\.getPackageName\(\)/);
  assert.match(patcher,/targetPackage\.endsWith\("\.packagedgueststep9"\)/);
  assert.doesNotMatch(publicWeb,/ByeolharuDeviceSettings|nativeReminders|onEnabledChange/);
});
test("manual repair is exposed only after a real mismatch with opt-in and OS permission",()=>{
  const mismatched={status:"out-of-sync"};
  assert.equal(canManuallyRepairGuestReminders(mismatched,true,"granted"),true);
  for(const status of ["synced","permission-required","snapshot-not-ready","disabled","unexpected-pending"]){
    assert.equal(canManuallyRepairGuestReminders({status},true,"granted"),false,status);
  }
  assert.equal(canManuallyRepairGuestReminders(mismatched,true,"denied"),false);
  assert.equal(canManuallyRepairGuestReminders(mismatched,true,"unknown"),false);
  assert.equal(canManuallyRepairGuestReminders(mismatched,false,"granted"),false);
  assert.equal(canManuallyRepairGuestReminders(null,true,"granted"),false);
  assert.match(entry,/setRepairAvailable\(canManuallyRepairGuestReminders\(report, enabledRef\.current, permissions\.display\)\)/);
  assert.match(account,/nativeReminders\.repairAvailable &&/);
  // Repair itself still checks permission and fresh snapshot at execution time.
  const repair=readFileSync(resolve(root,"mobile/notifications/guest-reminder-repair.js"),"utf8");
  assert.match(repair,/localNotifications\.checkPermissions\(\)/);
  assert.match(repair,/permission\.display !== "granted"/);
  assert.match(repair,/snapshot\.day !== localDayKey\(now\)/);
});
test("denied OS permission cannot silently clear opt-in, native queue or habit data",()=>{
  const start=entry.indexOf("if (!granted) {");
  const end=entry.indexOf("return;",start);
  assert.ok(start>=0 && end>start);
  const denial=entry.slice(start,end);
  assert.doesNotMatch(denial,/localStorage\.setItem|schedule\(|lifecycle\.disable\(|setEnabled\(false\)/);
  assert.match(entry,/if \(!granted\) \{\s*try/);
  assert.match(account,/알림을 받을 수 없어 스위치가 꺼져 있어요/);
});
