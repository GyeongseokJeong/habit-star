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
  assert.match(account, /nativeReminders\.onEnabledChange/);
  assert.match(ui, /disabled=\{alarmChecking \|\| \(!draft\.scheduledTime && !draft\.alarmEnabled\)\}/);
});
test("STEP 10 uses only committed snapshots and no native automatic opt-in", () => {
  const app = read("mobile/packaged-guest/main.tsx");
  assert.match(app, /onSnapshot = useCallback/);
  assert.match(app, /enabledRef\.current/);
  assert.match(app, /localStorage\.getItem\(OPT_IN_KEY\) === "1"/);
  assert.match(app, /localStorage\.setItem\(OPT_IN_KEY, next \? "1" : "0"\)/);
  assert.match(app, /if \(next\) \{/);
  assert.match(app, /await LocalNotifications\.requestPermissions\(\)/);
  assert.doesNotMatch(app, /auth\.getUser\(|supabase\(|NEXT_PUBLIC_SUPABASE/);
});

test("STEP 11 preserves scheduled jobs until the guest repository finishes loading", () => {
  const app = read("mobile/packaged-guest/main.tsx");
  const gate = read("mobile/notifications/guest-reminder-readiness.js");
  assert.match(app, /guestReminderAction\(value, context\.snapshot\)/);
  assert.match(app, /action === "await-snapshot" \|\| action === "await-today"/);
  assert.match(app, /if \(!saved\) void schedule\(false, null\)/);
  assert.match(gate, /return "await-today"/);
});
