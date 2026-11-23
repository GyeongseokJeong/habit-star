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
  assert.doesNotMatch(account,/aria-label="습관 알림"/);
  assert.match(account,/nativeReminders\.permissionState === "denied"/);
  assert.match(entry,/reminderSwitchChecked\(enabled === true \|\| \(enabled === null && hasHabitIntent\), permissionState\)/);
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
  assert.match(patcher, /assert\.equal\(\s*targetPackage,\s*process\.env\.BYEOLHARU_ANDROID_RELEASE === "1"\s*\? "app\.byeolharu\.android"\s*: "io\.github\.gyeongseokjeong\.byeolharu\.packagedgueststep9",\s*"Refusing to patch another Android package"/);
  assert.doesNotMatch(publicWeb,/ByeolharuDeviceSettings|nativeReminders|onEnabledChange/);
});
test("internal repair remains gated behind a real mismatch without public settings controls",()=>{
  const mismatched={status:"out-of-sync"};
  assert.equal(canManuallyRepairGuestReminders(mismatched,true,"granted"),true);
  for(const status of ["synced","permission-required","snapshot-not-ready","disabled","unexpected-pending"]){
    assert.equal(canManuallyRepairGuestReminders({status},true,"granted"),false,status);
  }
  assert.equal(canManuallyRepairGuestReminders(mismatched,true,"denied"),false);
  assert.equal(canManuallyRepairGuestReminders(mismatched,true,"unknown"),false);
  assert.equal(canManuallyRepairGuestReminders(mismatched,false,"granted"),false);
  assert.equal(canManuallyRepairGuestReminders(null,true,"granted"),false);
  assert.match(entry,/setRepairAvailable\(canManuallyRepairGuestReminders\(report, effectiveHabitReminderOptIn\(enabledRef\.current, snapshot\.current\) \|\| hasEnabledWrapup\(wrapupRef\.current\), permissions\.display\)\)/);
  assert.doesNotMatch(account,/nativeReminders\.repairAvailable|onRepairPending|알림 문제 해결/);
  // Repair itself still checks permission and fresh snapshot at execution time.
  const repair=readFileSync(resolve(root,"mobile/notifications/guest-reminder-repair.js"),"utf8");
  assert.match(repair,/localNotifications\.checkPermissions\(\)/);
  assert.match(repair,/permission\.display !== "granted"/);
  assert.match(repair,/snapshot\.day !== localDayKey\(now\)/);
});
test("denied OS permission cannot silently clear opt-in, native queue or habit data",()=>{
  const start=entry.indexOf("if (!granted) {");
  const end=entry.indexOf("return false;",start);
  assert.ok(start>=0 && end>start);
  const denial=entry.slice(start,end);
  assert.doesNotMatch(denial,/localStorage\.setItem|schedule\(|lifecycle\.disable\(|setEnabled\(false\)/);
  assert.match(entry,/if \(!granted\) \{\s*try/);
  assert.match(account,/권한이 차단되어 알림이 오지 않아요./);
  assert.match(account,/aria-label="기기 알림 권한"/);
  assert.doesNotMatch(account,/aria-checked=\{nativeReminders\.active\}/);
});

test("habit editor asks Android to enable reminders before turning its alarm on",()=>{
  const app=readFileSync(resolve(root,"components/byeolharu.tsx"),"utf8");
  const controls=readFileSync(resolve(root,"lib/habits/native-reminder-controls.ts"),"utf8");
  assert.match(app,/onEnsureNativeAlarm=\{nativeReminders \? \(\) => nativeReminders\.onEnabledChange\(true\)/);
  assert.match(app,/const enabled = await onEnsureNativeAlarm\?\.\(\)/);
  assert.match(app,/if \(enabled\) setDraft\(\(prev\) => \(\{ \.\.\.prev, alarmEnabled: true \}\)\)/);
  assert.match(app,/alarmChecking \|\| \(!draft\.scheduledTime && !draft\.alarmEnabled\)/);
  // The editor previews explicit reminder intent; OS permission is checked at save.
  assert.match(app,/aria-checked=\{Boolean\(draft\.alarmEnabled\)\}/);
  assert.match(app,/alarmForSelectedTime\(/);
  assert.match(app,/alarmPermissionDenied = !alarmEnabled/);
  assert.match(app,/await onSave\(/);
  assert.match(controls,/onEnabledChange: \(next: boolean\) => Promise<boolean>/);
  assert.match(entry,/const onEnabledChange = useCallback\(async \(next: boolean\): Promise<boolean>/);
  assert.match(entry,/return false;/);
  assert.match(entry,/return true;/);
});
