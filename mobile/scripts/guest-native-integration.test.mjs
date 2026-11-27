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
  const permission = read("mobile/notifications/notification-permission-onboarding.js");
  assert.match(entry, /await runReminderPermissionSetup\(\{/);
  assert.match(permission, /await requestHabitReminderPermission\(localNotifications, current.permissionState\)/);
  assert.match(permission, /localNotifications\.requestPermissions\(\)/);
  assert.doesNotMatch(entry, /LocalNotifications\.requestPermissions\(\)/);
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
  assert.match(ui, /onEnsureNativeAlarm=\{nativeReminders \? \(\) => scope === activeScope\.current\s*\? nativeReminders\.onEnabledChange\(true\) : Promise\.resolve\(false\)/);
  assert.match(ui, /isCurrentEditorScope=\{\(\) => scope === activeScope\.current\}/);
  assert.match(ui, /disabled=\{alarmChecking \|\| \(!draft\.scheduledTime && !draft\.alarmEnabled\)\}/);
});
test("STEP 10 respects existing per-habit opt-in without requesting OS permissions on startup", () => {
  const app = read("mobile/packaged-guest/main.tsx");
  assert.match(app, /onSnapshot = useCallback/);
  assert.match(app, /enabledRef\.current/);
  assert.match(app, /effectiveHabitReminderOptIn\(value, next\)/);
  assert.match(app, /const ready = isReminderSnapshotReady\(next, memberUserId\)/);
  assert.match(app, /snapshot\.current = ready \? next : null/);
  assert.match(app, /setHasHabitIntent\(ready && hasConfiguredHabitReminders\(next\)\)/);
  assert.match(app, /const preference = localStorage\.getItem\(OPT_IN_KEY\)/);
  assert.match(app, /preference === "1" \? true : preference === "0" \? false : null/);
  assert.match(app, /localStorage\.setItem\(OPT_IN_KEY, next \? "1" : "0"\)/);
  assert.match(app, /if \(next\) \{/);
  const permission = read("mobile/notifications/notification-permission-onboarding.js");
  const startup = app.slice(app.indexOf("const refreshPermission ="), app.indexOf("const widgetQueue ="));
  assert.match(startup, /void refreshPermission\(\)/);
  assert.match(startup, /await onCheckPermissions\(\)/);
  assert.doesNotMatch(startup, /requestHabitReminderPermission|requestPermissions\(|openNotificationSettings\(|changeExactNotificationSetting\(/);
  assert.match(permission, /localNotifications\.checkPermissions\(\)/);
  assert.match(permission, /localNotifications\.checkExactNotificationSetting\(\)/);
  assert.doesNotMatch(app, /auth\.getUser\(|supabase\(|NEXT_PUBLIC_SUPABASE/);
});

test("STEP 11 preserves scheduled jobs until the guest repository finishes loading", () => {
  const app = read("mobile/packaged-guest/main.tsx");
  const gate = read("mobile/notifications/guest-reminder-readiness.js");
  assert.match(app, /guestReminderAction\(context\.optIn \|\| hasEnabledWrapup\(context\.wrapupSettings\), context\.snapshot\)/);
  assert.match(app, /action === "await-snapshot" \|\| action === "await-today"/);
  assert.doesNotMatch(app, /if \(!saved.*schedule\(false, null\)/);
  assert.match(app, /if \(snapshot\.current\) \{/);
  assert.match(app, /!isReminderSnapshotReady\(next, context.identity.kind === "member" \? context.identity.userId : null\)\) return/);
  assert.match(app, /if \(!ready \|\| !next\) return/);
  assert.match(gate, /return "await-today"/);
});


test("shared confirmation protects unsaved drafts, habit deletion and Android restore", () => {
  const ui = read("components/byeolharu.tsx");
  const panel = read("components/account/account-panel.tsx");
  const confirm = read("components/confirm-dialog.tsx");
  const css = read("app/globals.css");
  const native = read("mobile/native/MainActivity.java.template");
  const comparison = read("lib/habits/unsaved-draft.ts");

  assert.match(ui, /onClose=\{requestClose\}/);
  assert.match(ui, /guardUnsaved=\{Boolean\(nativeReminders\)\}/);
  assert.match(ui, /hasUnsavedHabitSettings\(initialDraft\.current, draft\)/);
  assert.match(ui, /hasUnsavedDailyRecord\(initialDraft\.current, draft\)/);
  assert.match(ui, /title="이 습관을 삭제할까요\?"/);
  assert.match(ui, /cancelLabel="유지하기"/);
  assert.match(ui, /confirmLabel="삭제하기"/);
  assert.doesNotMatch(ui, /className="delete-confirmation"/);
  assert.match(comparison, /initial\.scheduledTime/);
  assert.match(comparison, /initial\.memo/);

  assert.match(panel, /title="백업을 복원할까요\?"/);
  assert.match(panel, /inspectPortableBackup\(content, scope\)/);
  assert.match(panel, /inspectPortableBackup\(selected\.content, selected\.scope\)/);
  assert.match(panel, /await app\.restore\(selected\.content\)/);
  assert.match(panel, /currentScope !== selected\.scope/);
  assert.doesNotMatch(panel, /window\.confirm\(/);

  assert.match(confirm, /createPortal\(/);
  assert.match(confirm, /dialog\?\.showModal\(\)/);
  assert.match(confirm, /onCancel=\{\(event\) => \{/);
  assert.match(confirm, /data-confirm-cancel/);
  assert.match(confirm, /disabled=\{busy\}/);
  assert.match(css, /\.byeolharu-confirm-dialog::backdrop/);
  assert.match(css, /\.byeolharu-confirm-dialog-actions > button/);
  assert.match(native, /byeolharu-confirm-dialog\[open\]/);
  assert.match(native, /data-confirm-cancel/);
  assert.doesNotMatch(css, /\.android-unsaved-dialog\s*\{/);
});


test("individual reminder tap reuses guarded record detail without auto-completing", () => {
  const native = read("mobile/packaged-guest/main.tsx");
  const ui = read("components/byeolharu.tsx");
  assert.match(native, /parseHabitReminder\(extra\)/);
  assert.match(native, /nativeHabitNavigation=\{isAndroid \? habitNavigation : null\}/);
  assert.match(ui, /resolveHabitReminder\(nativeHabitNavigation/);
  assert.match(ui, /blocked: Boolean\(editing \|\| detailId \|\| accountOpen/);
  assert.match(ui, /setDetailId\(result\.habit\.id\)/);
  assert.match(ui, /nativeDetailOrigin\.day !== dateKey\(new Date\(\)/);
  assert.match(native, /extra\?\.category === "wrapup"/);
});
