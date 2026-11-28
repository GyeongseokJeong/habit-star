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
 assert.match(ui,/aria-label="알림 설정 안내"/);
 assert.doesNotMatch(ui,/onInspectLatency|latencyStatus|최근 알림 지연 확인/);
 assert.match(ui,/nativeReminders\.onRequestPermission\(/);
 assert.match(ui,/nativeReminders\.permissionState !== "granted"/);
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

test("wrap-up pending work never shifts settings or dims a committed ON period", () => {
 const card = ui.slice(ui.indexOf('aria-label="시간대 마무리 알림"'), ui.indexOf('>화면</AccountSectionTitle>'));
 assert.match(card, /data-enabled=\{choice.enabled\}/);
 assert.match(card, /disabled=\{!choice.enabled \|\| working\}/);
 assert.match(card, /disabled=\{working\} aria-busy=\{workingAction === "wrapup-" \+ group\}/);
 assert.match(card, /aria-busy=\{workingAction === "wrapup-time-" \+ group\}/);
 assert.match(card, /<p className="sr-only" role="status">\{workingAction\?\.startsWith\("wrapup-"\) \? "알림 설정을 확인하고 있어요…" : ""\}<\/p>/);
 assert.doesNotMatch(card, /className="account-note"/);
 assert.match(css, /\.android-wrapup-time select:disabled \{ opacity: \.55; \}/);
 assert.match(css, /\.android-wrapup-period\[data-enabled="true"\] \.android-wrapup-time select:disabled \{ opacity: 1; \}/);
 assert.match(css, /\.android-wrapup-toggle:disabled \{ opacity: 1; cursor: default; \}/);
 assert.match(ui, /if \(activeAction.current \|\| app.busy\) return/);
});

test("release settings distinguish missing display, exact, and unknown OS permission",()=>{
 const settings=ui.slice(ui.indexOf('{page === "settings" && ('),ui.indexOf('{page === "help" && ('));
 const notice=settings.slice(settings.indexOf('android-reminder-action-notice'),settings.indexOf('android-wrapup-settings'));
 assert.match(ui,/const displayPermissionNeeded = Boolean/);
 assert.match(ui,/const exactPermissionNeeded = Boolean/);
 assert.match(settings,/displayPermissionNeeded \|\| exactPermissionNeeded/);
 assert.match(notice,/onRequestPermission/);
 assert.doesNotMatch(notice,/onRequestExactPermission/);
 assert.match(notice,/onCheckPermissions/);
 assert.match(notice,/>알림 권한</);
 assert.match(notice,/설정하기/);
 assert.match(notice,/알림 허용 후 기기 설정 화면이 이어질 수 있어요/);
 assert.match(notice,/알림은 받을 수 있지만 설정한 시간보다 늦어질 수 있어요/);
 assert.match(notice,/aria-label="알림 설정 안내"/);
 assert.doesNotMatch(notice,/<ChevronRight/);
 assert.doesNotMatch(settings,/onInspectLatency|latencyStatus|최근 알림 지연 확인/);
 assert.match(settings,/role="status"/);
});

test("v3 settings preserve back and close, responsive controls and safe-area behavior",()=>{
 const app=readFileSync(resolve(root,"components/byeolharu.tsx"),"utf8");
 // Scope navigation assertions to the account modal. Ordinary close/back
 // still reset or return as before; an in-flight irreversible withdrawal
 // must not let close, back or Escape dismiss its confirmation state.
 const accountModal=app.slice(app.indexOf("{accountOpen && ("),app.indexOf("<AccountPanel",app.indexOf("{accountOpen && (")));
 assert.match(accountModal,/onClose=\{\(\) => \{ if \(!app\.deletingAccount\) \{ setAccountOpen\(false\); setAccountPage\("home"\); \} \}\}/);
 assert.match(accountModal,/onBack=\{accountPage !== "home" \? \(\) => \{ if \(!app\.deletingAccount\) setAccountPage\(accountPage === "withdraw" \? "security" : "home"\); \} : undefined\}/);
 assert.match(accountModal,/backLabel=\{accountPage === "withdraw" \? "계정 관리로" : "내 계정으로"\}/);
 assert.match(accountModal,/onEscape=\{\(\) => \{\s*if \(app\.deletingAccount\) return;\s*if \(accountPage !== "home"\) setAccountPage\(accountPage === "withdraw" \? "security" : "home"\);\s*else \{ setAccountOpen\(false\); setAccountPage\("home"\); \}/);
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


test("Android restored and deliberate alarm actions use the shared confirmation, not a home banner", () => {
 const app=readFileSync(resolve(root,"components/byeolharu.tsx"),"utf8");
 const guide=readFileSync(resolve(root,"components/reminder-permission-dialog.tsx"),"utf8");
 const confirm=readFileSync(resolve(root,"components/confirm-dialog.tsx"),"utf8");
 const native=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
 assert.doesNotMatch(app,/className="android-permission-invite"/);
 assert.match(guide,/습관 알림을 설정할까요\?/);
 assert.match(guide,/cancelLabel="나중에"/);
 assert.match(guide,/confirmLabel="알림 설정하기"/);
 assert.match(guide,/initialFocus="heading"/);
 assert.match(guide,/primaryAction="confirm"/);
 assert.match(guide,/나중에 해도 알림은 받을 수 있어요/);
 assert.match(guide,/기기 설정 화면이 이어질 수 있어요/);
 assert.match(guide,/pending\.current\?\.dismiss\?\.\(\)/);
 assert.match(app,/const startupPermissionOpen = Boolean\(nativeReminders\?\.startupPermissionOffer/);
 assert.match(app,/startupDataReady\(!!app.user, app.snapshot\)/);
 assert.match(app,/!editing && !detailId && !accountOpen && !constellationOpen && !reflectionOpen/);
 assert.match(app,/onDismissStartupPermissionOffer\(\)/);
 assert.match(app,/onRequestStartupPermission\(\(\) => scope === activeScope.current/);
 assert.match(app,/onCheckNativePermissions=\{nativeReminders\?\.onCheckPermissions\}/);
 assert.match(app,/onRequestPermission=\{nativeReminders\?\.onRequestPermission\}/);
 assert.doesNotMatch(app,/onRequestNativeExactPermission/);
 assert.match(app,/permissionGuide\.ask\(checked,/);
 assert.doesNotMatch(app,/permissionGuide\.ask\("exact"/);
 assert.match(app,/if \(activateDevice && \(!nativeAlarmActive \|\| needsDisplay\) && !await onEnsureNativeAlarm\(\)\) return false/);
 assert.match(app,/granted = await enableNativeAlarm\(!habit\?\.alarmEnabled && alarmCheckedTime.current === undefined\)/);
 assert.match(app,/const enabled = await enableNativeAlarm\(true\)/);
 assert.match(app,/alarmPermissionDeferred = Boolean\(habit\?\.alarmEnabled\)/);
 assert.match(app,/nativeAlarmIntentEnabled && draft.scheduledTime !== habit.scheduledTime/);
 assert.match(app,/if \(!isCurrentEditorScope\(\) \|\| \(needsDisplay && !accepted\)\) return false/);
 assert.match(app,/editorScope.current === scope/);
 assert.match(app,/editorMounted.current && isParentEditorScope\(\)/);
 assert.match(app,/startupPermissionContextRef.current === context/);
 assert.match(confirm,/primaryAction === "confirm"/);
 assert.match(confirm,/data-confirm-cancel/);
 assert.match(confirm,/initialFocus = "cancel"/);
 assert.match(confirm,/initialFocus === "heading" \? headingRef : cancelRef/);
 assert.match(css,/\.byeolharu-confirm-dialog\.is-permission-opt-in \.byeolharu-confirm-dialog-actions \{ gap: 10px; \}/);
 assert.match(native,/startupPermissionOffer/);
 assert.match(native,/onCheckPermissions/);
 assert.match(native,/onDismissPermissionOffer: dismissPermissionOffer/);
 assert.doesNotMatch(css,/\.android-permission-invite\s*\{/);
});

test("wrap-up permission retry is deliberate and exact access cannot block the saved choice", () => {
 const action=ui.slice(ui.indexOf("const changeWrapup = async"),ui.indexOf("const lastSyncAt"));
 assert.match(action,/patch.enabled === true \|\| \(patch.time !== undefined && previous.enabled\)/);
 assert.match(action,/onCheckPermissions\(\)/);
 assert.match(action,/permissionGuide.ask\(checked,/);
 assert.match(action,/account !== currentAccount.current/);
 assert.ok(action.indexOf("permissionGuide.ask(checked,") < action.indexOf("await nativeReminders.onWrapupChange"));
 assert.match(action,/checked.permissionState !== "granted" && !accepted/);
 assert.match(action,/isSettingsCurrent\(\)/);
 assert.doesNotMatch(action,/onRequestExactPermission/);
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
