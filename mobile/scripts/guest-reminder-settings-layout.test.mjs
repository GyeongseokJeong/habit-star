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
 const first=section.indexOf('AccountSectionTitle className="account-settings-group-title">알림');
 const second=section.indexOf('AccountSectionTitle className="account-settings-group-title">화면');
 const third=section.indexOf('AccountSectionTitle className="account-settings-group-title">기록');
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

test("account screens share design elements and no settings-only landscape",()=>{
 assert.match(ui,/account-ui-card account-help-list/);
 assert.match(ui,/account-ui-card account-action-group/);
 assert.match(ui,/account-ui-card account-setting-block android-wrapup-settings/);
 assert.doesNotMatch(ui,/account-settings-landscape/);
 assert.match(css,/Account Design System v1/);
});


test("Android first habit reminder uses a one-time in-context modal, not a home banner", () => {
 const app=readFileSync(resolve(root,"components/byeolharu.tsx"),"utf8");
 const confirm=readFileSync(resolve(root,"components/confirm-dialog.tsx"),"utf8");
 const native=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
 assert.doesNotMatch(app,/className="android-permission-invite"/);
 assert.match(app,/title="습관 알림을 받아볼까요\?"/);
 assert.match(app,/cancelLabel="나중에"/);
 assert.match(app,/confirmLabel="알림 허용하기"/);
 assert.match(app,/primaryAction="confirm"/);
 assert.match(app,/onDismissFirstPermission\?\.\(\)/);
 assert.match(app,/nativeFirstPermissionOffer=\{nativeReminders\?\.showPermissionOffer\}/);
 assert.match(app,/onRequestFirstPermission=\{nativeReminders\?\.onRequestPermission\}/);
 assert.match(app,/if \(!\(await promptForFirstPermission\(\)\)\) return false/);
 assert.match(app,/alarmEnabled = await enableNativeAlarm\(\)/);
 assert.match(app,/const enabled = await enableNativeAlarm\(\)/);
 assert.match(confirm,/primaryAction === "confirm"/);
 assert.match(confirm,/data-confirm-cancel/);
 assert.match(native,/shouldShowPermissionOffer\(/);
 assert.match(native,/onDismissPermissionOffer: dismissPermissionOffer/);
 assert.doesNotMatch(css,/\.android-permission-invite\s*\{/);
});

test("sample cleanup uses one shared, non-destructive confirmation", () => {
 const app=readFileSync(resolve(root,"components/byeolharu.tsx"),"utf8");
 assert.match(app,/title=\{\`예시 습관 \$\{sampleHabits.length\}개를 정리할까요\?\`\}/);
 assert.match(app,/confirmLabel="예시만 정리"/);
 assert.match(app,/cancelLabel="유지하기"/);
 assert.match(app,/busy=\{sampleCleanupBusy\}/);
 assert.doesNotMatch(app,/className="sample-cleanup-actions"/);
 assert.match(app,/sampleIds\.has\(habit.id\)/);
 assert.match(app,/previous\.filter\(\(habit\) => !sampleIds\.has\(habit\.id\)\)/);
});

test("account feedback uses semantic tone and the delete confirmation stays two lines", () => {
 const app=readFileSync(resolve(root,"components/byeolharu.tsx"),"utf8");
 const tone=readFileSync(resolve(root,"components/account/account-feedback-tone.ts"),"utf8");
 assert.match(ui,/className=\{"auth-feedback account-feedback is-" \+ feedbackTone\}/);
 assert.match(ui,/role=\{feedbackTone === "error" \? "alert" : "status"\}/);
 assert.match(ui,/setTimeout\(\(\) => setFeedbackVisible\(false\), 4000\)/);
 assert.match(css,/\.account-panel\.account-hub > \.account-feedback \{\s*margin: 16px 0 0/);
 assert.match(css,/\.account-panel\.account-hub > \.account-feedback\.is-error/);
 assert.match(tone,/못했/);
 assert.match(app,/confirm-description-line/);
 assert.match(app,/cancelLabel="유지하기"/);
 assert.match(app,/confirmLabel="삭제하기"/);
});
