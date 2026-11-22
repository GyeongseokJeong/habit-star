import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const read = path => readFileSync(resolve(root, path), "utf8");

test("only bundled guest entrypoint imports native Capacitor reminders", () => {
  const entry = read("mobile/packaged-guest/main.tsx");
  const website = read("app/page.tsx");
  assert.match(entry, /@capacitor\/local-notifications/);
  assert.match(entry, /createReminderLifecycle/);
  assert.match(entry, /const OPT_IN_KEY/);
  assert.match(entry, /requestPermissions\(\)/);
  assert.match(entry, /identity = \{ kind: "guest"/);
  assert.doesNotMatch(website, /Capacitor|nativeReminders|LocalNotifications/);
});
test("guest opt-in UI is passed only as an optional prop", () => {
  const ui = read("components/byeolharu.tsx");
  const entry = read("mobile/packaged-guest/main.tsx");
  const account = read("components/account/account-panel.tsx");
  assert.match(ui, /nativeReminders\?: NativeReminderControls/);
  assert.match(ui, /onAccountSnapshot\?\.\(app\.snapshot, app\.user\?\.id \?\? null\)/);
  assert.match(entry, /identity: identityRef\.current/);
  assert.match(entry, /reminderIdentityKey\(identityRef\.current\) !== reminderIdentityKey\(nextIdentity\)/);
  assert.match(ui, /nativeAlarmEditor=\{Boolean\(nativeReminders\)\}/);
  assert.match(account, /\{nativeReminders && \(/);
  // Profile settings no longer own a second/global opt-in switch.
  assert.doesNotMatch(account, /nativeReminders\.onEnabledChange/);
  // Habit editor still routes per-habit opt-in to the native permission flow.
  assert.match(ui, /onEnsureNativeAlarm=\{nativeReminders \? \(\) => nativeReminders\.onEnabledChange\(true\)/);
  assert.match(ui, /disabled=\{alarmChecking \|\| \(!draft\.scheduledTime && !draft\.alarmEnabled\)\}/);
});
test("STEP 10 respects existing per-habit opt-in without requesting OS permissions on startup", () => {
  const app = read("mobile/packaged-guest/main.tsx");
  assert.match(app, /onSnapshot = useCallback/);
  assert.match(app, /enabledRef\.current/);
  assert.match(app, /effectiveHabitReminderOptIn\(value, next\)/);
  assert.match(app, /setHasHabitIntent\(hasConfiguredHabitReminders\(next\)\)/);
  assert.match(app, /const preference = localStorage\.getItem\(OPT_IN_KEY\)/);
  assert.match(app, /preference === "1" \? true : preference === "0" \? false : null/);
  assert.match(app, /localStorage\.setItem\(OPT_IN_KEY, next \? "1" : "0"\)/);
  assert.match(app, /if \(next\) \{/);
  assert.match(app, /await LocalNotifications\.requestPermissions\(\)/);
  assert.doesNotMatch(app, /auth\.getUser\(|supabase\(|NEXT_PUBLIC_SUPABASE/);
});

test("STEP 11 preserves scheduled jobs until the guest repository finishes loading", () => {
  const app = read("mobile/packaged-guest/main.tsx");
  const gate = read("mobile/notifications/guest-reminder-readiness.js");
  assert.match(app, /guestReminderAction\(context\.optIn \|\| hasEnabledWrapup\(context\.wrapupSettings\), context\.snapshot\)/);
  assert.match(app, /action === "await-snapshot" \|\| action === "await-today"/);
  assert.doesNotMatch(app, /if \(!saved.*schedule\(false, null\)/);
  assert.match(app, /if \(snapshot\.current\) \{/);
  assert.match(gate, /return "await-today"/);
});
