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
 assert.match(android,/<Byeolharu nativeReminders=\{nativeReminders\} nativeShare=\{isAndroid \? shareStarlightPngOnAndroid : undefined\} \/>/);
});

test("shared account settings render native reminder actions only when provided by Android guest",()=>{
 const account=read("components/account/account-panel.tsx");
 const app=read("components/byeolharu.tsx");
 const native=read("lib/habits/native-reminder-controls.ts");
 assert.match(account,/nativeReminders\?: NativeReminderControls/);
 assert.match(account,/\{nativeReminders && \(/);
 assert.match(account,/aria-checked=\{nativeReminders\.active\}/);
 assert.match(account,/nativeReminders\.permissionState === "denied"/);
 assert.match(app,/nativeReminders\?: NativeReminderControls/);
 assert.match(app,/nativeAlarmEditor=\{Boolean\(nativeReminders\)\}/);
 assert.match(native,/import type \{ Snapshot \}/);
 assert.doesNotMatch(native,/import.*@capacitor/);
});

test("web habit time edits preserve prior behavior; native editor alone clears invalid alarm toggle",()=>{
 const app=read("components/byeolharu.tsx");
 assert.match(app,/nativeAlarmEditor && !e\.target\.value \? \{ alarmEnabled: false \} : \{\}/);
 assert.doesNotMatch(app,/scheduledTime: e\.target\.value, alarmEnabled:/);
 assert.match(app,/nativeAlarmEditor = false/);
 assert.match(app,/disabled=\{!draft\.scheduledTime && !draft\.alarmEnabled\}/);
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
