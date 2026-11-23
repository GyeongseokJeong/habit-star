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
 const first=section.indexOf('account-settings-group-title"><BellRing');
 const second=section.indexOf('account-settings-group-title"><MonitorSmartphone');
 const third=section.indexOf('account-settings-group-title"><Clock3');
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
 assert.match(ui,/disabled={!choice.enabled \|\| working}/);
 assert.match(ui,/value={choice.time}/);
 assert.match(ui,/android-wrapup-inline-row/);
 assert.match(ui,/const PeriodIcon = group === "morning" \? Sunrise/);
 assert.match(css,/grid-template-columns: minmax\(0, 1fr\) 102px 56px/);
 assert.match(ui,/nativeReminders.onWrapupChange/);
 assert.doesNotMatch(ui,/aria-label="습관 알림"/);
 assert.match(entry,/localNotificationActionPerformed/);
 assert.doesNotMatch(web,/onWrapupChange|localNotificationActionPerformed/);
});

test("v3 release settings show actionable denied permission but no misleading granted chevron",()=>{
 const settings=ui.slice(ui.indexOf('{page === "settings" && ('),ui.indexOf('{page === "help" && ('));
 const perm=settings.slice(settings.indexOf('android-permission-summary'),settings.indexOf('android-wrapup-settings'));
 assert.match(perm,/permissionState === "granted"/);
 assert.match(perm,/기기 설정 열기/);
 assert.match(perm,/알림 허용하기/);
 assert.match(perm,/onRequestPermission/);
 assert.doesNotMatch(perm,/<ChevronRight/);
 assert.match(perm,/role="status"/);
});

test("v3 settings preserve back and close, responsive controls and safe-area behavior",()=>{
 const app=readFileSync(resolve(root,"components/byeolharu.tsx"),"utf8");
 assert.match(app,/onClose=\{\(\) => \{ setAccountOpen\(false\); setAccountPage\("home"\); \}\}/);
 assert.match(app,/onBack=\{accountPage !== "home"/);
 assert.match(css,/@media \(max-width: 350px\)/);
 assert.match(css,/min-height: 44px/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(ui,/aria-label=\{name \+ " 마무리 알림 시간"\}/);
 assert.match(ui,/account-timezone-trigger/);
 assert.match(nativeCss,/account-screen/);
});
