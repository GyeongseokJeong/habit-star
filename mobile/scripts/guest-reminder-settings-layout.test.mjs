import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"../..");
const ui=readFileSync(resolve(root,"components/account/account-panel.tsx"),"utf8");
const css=readFileSync(resolve(root,"app/globals.css"),"utf8");
const nativeCss=readFileSync(resolve(root,"mobile/packaged-guest/safe-area.css"),"utf8");
const web=readFileSync(resolve(root,"app/page.tsx"),"utf8");

test("release settings remove developer diagnostics without removing native recovery engines",()=>{
 assert.doesNotMatch(ui,/android-reminder-details|알림 문제 해결|onInspectPending|onAuditPending|onRepairPending/);
 assert.doesNotMatch(nativeCss,/android-reminder-details|android-reminder-detail-actions/);
 assert.match(ui,/aria-label="기기 알림 권한"/);
 assert.match(ui,/nativeReminders\.onRequestPermission\(\)/);
 assert.match(ui,/nativeReminders\.permissionState === "denied"/);
 const entry=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
 assert.match(entry,/onInspectPending/);
 assert.match(entry,/onAuditPending/);
 assert.match(entry,/onRepairPending/);
 assert.doesNotMatch(web,/onInspectPending|onAuditPending|onRepairPending/);
});

test("settings order keeps notifications, appearance, and recording distinct",()=>{
 const section=ui.slice(ui.indexOf('{page === "settings" && ('),ui.indexOf('{page === "help" && ('));
 const first=section.indexOf('account-settings-group-title">알림');
 const second=section.indexOf('account-settings-group-title">화면');
 const third=section.indexOf('account-settings-group-title">기록');
 assert.ok(first>=0 && second>first && third>second);
 assert.match(section,/>기록 시간대</);
 assert.match(section,/role="switch"/);
 assert.match(section,/aria-pressed={theme === "system"}/);
 assert.match(section,/aria-checked={compactView}/);
 assert.match(css,/\.account-panel \.account-settings-final/);
});

test("three independent wrap-up settings keep user intent and reveal time only while enabled",()=>{
 const entry=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
 assert.match(ui,/aria-label="시간대 마무리 알림"/);
 assert.match(ui,/role="switch" className="compact-setting-toggle android-wrapup-toggle"/);
 assert.match(ui,/aria-checked={choice.enabled}/);
 assert.match(ui,/{choice.enabled && \(/);
 assert.match(ui,/value={choice.time}/);
 assert.match(ui,/nativeReminders.onWrapupChange/);
 assert.doesNotMatch(ui,/aria-label="습관 알림"/);
 assert.match(entry,/localNotificationActionPerformed/);
 assert.doesNotMatch(web,/onWrapupChange|localNotificationActionPerformed/);
});
