import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"../..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("public website does not instantiate native app notifications or device settings",()=>{
 const web=read("app/page.tsx");
 const android=read("mobile/packaged-guest/main.tsx");
 assert.match(web,/<Byeolharu \/>/);
 assert.doesNotMatch(web,/nativeReminders|@capacitor|LocalNotifications|registerPlugin/);
 assert.match(android,/<Byeolharu nativeReminders=\{nativeReminders\}/);
 assert.match(android,/nativeReminderNavigation=\{isAndroid \? wrapupNavigation : null\}/);
 assert.match(android,/nativeAuthReturn=\{isAndroid \? nativeAuthReturn : undefined\}/);
});

test("shared account settings render native reminder actions only when provided by Android guest",()=>{
 const account=read("components/account/account-panel.tsx");
 const app=read("components/byeolharu.tsx");
 const native=read("lib/habits/native-reminder-controls.ts");
 assert.match(account,/nativeReminders\?: NativeReminderControls/);
 assert.match(account,/\{nativeReminders && \(/);
 assert.doesNotMatch(account,/aria-checked=\{nativeReminders\.active\}/);
 assert.doesNotMatch(account,/알림 문제 해결|android-reminder-details/);
 assert.match(account,/aria-label="알림 설정 안내"/);
 assert.match(account,/nativeReminders\.permissionState !== "granted"/);
 assert.match(app,/nativeReminders\?: NativeReminderControls/);
 assert.match(app,/nativeAlarmEditor=\{Boolean\(nativeReminders\)\}/);
 assert.match(native,/import type \{ Snapshot \}/);
 assert.doesNotMatch(native,/import.*@capacitor/);
});

test("web time edits preserve reminders; Android alone conditionally opts in after direct time choice",()=>{
 const app=read("components/byeolharu.tsx");
 const policy=read("lib/habits/alarm-default-policy.ts");
 assert.match(app,/alarmForSelectedTime\(\{/);
 assert.match(app,/isNewHabit: !habit/);
 assert.match(app,/android: nativeAlarmEditor/);
 assert.match(app,/userToggledAlarm: alarmTouched/);
 assert.match(app,/alarmEnabled: nativeAlarmEditor \? alarmEnabled : draft.alarmEnabled/);
 assert.match(policy,/if \(android && isNewHabit && !userToggledAlarm\) return true/);
 assert.match(policy,/if \(!time\) return false/);
 assert.match(app,/disabled=\{alarmChecking \|\| \(!draft\.scheduledTime && !draft\.alarmEnabled\)\}/);
});

test("native resume listener is removed during cleanup and ordinary online refresh remains separate",()=>{
 const hook=read("lib/habits/use-habit-app.ts");
 assert.match(hook,/window\.addEventListener\("byeolharu:native-resume", nativeResume\)/);
 assert.match(hook,/window\.removeEventListener\("byeolharu:native-resume", nativeResume\)/);
 assert.match(hook,/window\.addEventListener\("online", online\)/);
 assert.match(hook,/document\.addEventListener\("visibilitychange", visibleOnce\)/);
 assert.match(hook,/if \(now - lastForegroundTick < 800\) return/);
});

test("web CSS and TypeScript configuration retain narrowly scoped changes",()=>{
 const css=read("app/globals.css");
 const config=JSON.parse(read("tsconfig.json"));
 assert.match(css,/\.habit-editor-more\s*\{[^}]*min-width: 44px;/s);
 assert.ok(config.exclude.includes("node_modules"));
 assert.ok(config.exclude.includes("mobile"));
 assert.ok(config.include.includes("**/*.ts"));
 assert.ok(config.include.includes("**/*.tsx"));
});

test("Play app update is packaged-native only and its restart is a user action", () => {
 const app=read("components/byeolharu.tsx");
 const bridge=read("mobile/packaged-guest/native-app-update.ts");
 const notice=read("components/app-update-notice.tsx");
 const account=read("components/account/account-panel.tsx");
 const native=read("mobile/native/ByeolharuAppUpdatePlugin.java.template");
 assert.match(app,/nativeUpdates\?: NativeUpdateControls/);
 assert.match(app,/nativeUpdates\?\.notice && startupPermissionContext && !startupPermissionOpen && !app\.busy && !storageWarning/);
 assert.match(app,/updateBlocked=\{Boolean\(app\.busy \|\| ratingOverrides\.size \|\| storageWarning \|\| !ready\)\}/);
 assert.match(account,/nativeUpdates && <AppUpdateSettings/);
 assert.match(notice,/onClick=\{update\.act\}/);
 assert.match(bridge,/App\.addListener\("appStateChange"/);
 assert.match(bridge,/bridge\.addListener\("updateChanged"/);
 assert.match(bridge,/await plugin\.current\.complete\(\)/);
 assert.match(native,/if \(!"downloaded"\.equals\(describe\(info\)\.getString\("status"\)\)\)/);
 assert.doesNotMatch(app,/from ["']@capacitor\//);
});
