import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reminderPermissionPresentation } from "../notifications/guest-reminder-permission-view.js";

test("Android permission denial never conflates queued jobs with deliverable reminders",()=>{
  const result=reminderPermissionPresentation({optIn:true,permission:"denied",pendingCount:35});
  assert.equal(result.state,"blocked");
  assert.match(result.headline,/차단/);
  assert.match(result.queueNote,/35건/);
  assert.match(result.queueNote,/표시 불가/);
  assert.match(result.note,/휴대폰 설정/);
});
test("guest intent is kept independently of OS permission",()=>{
  const off=reminderPermissionPresentation({optIn:false,permission:"denied",pendingCount:35});
  assert.equal(off.state,"off");
  assert.equal(off.queueNote,undefined);
  assert.equal(reminderPermissionPresentation({optIn:true,permission:"granted"}).state,"ready");
  assert.equal(reminderPermissionPresentation({optIn:true,permission:"unknown"}).state,"unknown");
  assert.throws(()=>reminderPermissionPresentation({optIn:true,permission:"denied",pendingCount:-1}));
});
test("native settings warn on denied permission without mutating user opt-in or guest records",()=>{
  const root=resolve(import.meta.dirname,"../..");
  const main=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
  const account=readFileSync(resolve(root,"components/account/account-panel.tsx"),"utf8");
  const website=readFileSync(resolve(root,"app/page.tsx"),"utf8");
  assert.match(main,/LocalNotifications\.checkPermissions\(\)/);
  assert.match(main,/void refreshPermission\(\)/);
  assert.match(main,/presentation\.queueNote/);
  assert.match(main,/setPermissionState/);
  // Device permissions remain directly actionable; diagnostic tools are not shown in public settings.
  assert.match(account,/aria-label="기기 알림 권한"/);
  assert.doesNotMatch(account,/android-reminder-details|onInspectPending/);
  assert.match(account,/nativeReminders\.permissionState === "denied"/);
  assert.match(account,/권한이 차단되어 알림이 오지 않아요./);
  assert.doesNotMatch(account,/aria-checked=\{nativeReminders\.active\}/);
  assert.doesNotMatch(account,/nativeReminders\.onEnabledChange/);
  assert.doesNotMatch(website,/permissionState|reminderPermissionPresentation/);
});
