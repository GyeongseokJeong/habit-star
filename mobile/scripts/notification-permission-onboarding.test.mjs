import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { permissionStateFromAndroid, shouldShowPermissionOffer } from "../notifications/notification-permission-onboarding.js";

test("Android permission states do not confuse a first-time prompt with a blocked permission", () => {
  assert.equal(permissionStateFromAndroid("granted"), "granted");
  assert.equal(permissionStateFromAndroid("prompt"), "prompt");
  assert.equal(permissionStateFromAndroid("prompt-with-rationale"), "prompt");
  assert.equal(permissionStateFromAndroid("denied"), "denied");
  assert.equal(permissionStateFromAndroid("unexpected"), "unknown");
});

test("first-run invitation only appears once and never overrides an explicit opt-out", () => {
  const base = { permission: "prompt", seen: false, explicitlyDisabled: false };
  assert.equal(shouldShowPermissionOffer(base), true);
  assert.equal(shouldShowPermissionOffer({ ...base, seen: true }), false);
  assert.equal(shouldShowPermissionOffer({ ...base, explicitlyDisabled: true }), false);
  assert.equal(shouldShowPermissionOffer({ ...base, permission: "denied" }), false);
  assert.equal(shouldShowPermissionOffer({ ...base, permission: "granted" }), false);
  assert.equal(shouldShowPermissionOffer({ ...base, permission: "unknown" }), false);
});

test("native permission invitation stays outside the website entrypoint", () => {
  const native = readFileSync(new URL("../packaged-guest/main.tsx", import.meta.url), "utf8");
  const website = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../../components/byeolharu.tsx", import.meta.url), "utf8");
  assert.match(native, /onRequestPermission/);
  assert.match(native, /onDismissPermissionOffer/);
  assert.match(native, /PERMISSION_OFFER_SEEN_KEY/);
  assert.match(ui, /nativeReminders\?\.showPermissionOffer/);
  assert.doesNotMatch(website, /notification-permission-onboarding|LocalNotifications/);
});


test("habit editor first permission prompt requires eligible native onboarding, never startup", () => {
  const ui = readFileSync(new URL("../../components/byeolharu.tsx", import.meta.url), "utf8");
  const main = readFileSync(new URL("../packaged-guest/main.tsx", import.meta.url), "utf8");
  assert.match(main, /showPermissionOffer: shouldShowPermissionOffer\(/);
  assert.match(ui, /nativeFirstPermissionOffer=\{nativeReminders\?\.showPermissionOffer\}/);
  assert.match(ui, /onRequestFirstPermission=\{nativeReminders\?\.onRequestPermission\}/);
  assert.match(ui, /onDismissFirstPermission=\{nativeReminders\?\.onDismissPermissionOffer\}/);
  assert.match(ui, /if \(!nativeFirstPermissionOffer \|\| !onRequestFirstPermission \|\| !onDismissFirstPermission\) return true/);
  assert.match(ui, /title="습관 알림을 받아볼까요\?"/);
  assert.match(ui, /cancelLabel="나중에"/);
  assert.match(ui, /confirmLabel="알림 허용하기"/);
  assert.doesNotMatch(ui, /className="android-permission-invite"/);
});

test("both first opt-in entry points await the same permission dialog", () => {
  const ui = readFileSync(new URL("../../components/byeolharu.tsx", import.meta.url), "utf8");
  assert.match(ui, /const enableNativeAlarm = async \(\) => \{\s*if \(!\(await promptForFirstPermission\(\)\)\) return false;\s*return Boolean\(await onEnsureNativeAlarm\?\.\(\)\)/);
  assert.match(ui, /alarmEnabled = await enableNativeAlarm\(\)/); // default ON at timed habit save
  assert.match(ui, /const enabled = await enableNativeAlarm\(\)/); // explicit habit alarm ON
  assert.match(ui, /alarmPermissionDenied = !alarmEnabled/); // declined/denied -> saved OFF
  assert.match(ui, /onCancel=\{\(\) => \{\s*onDismissFirstPermission\?\.\(\);\s*settleFirstPermissionPrompt\(false\)/);
  assert.match(ui, /const granted = Boolean\(await onRequestFirstPermission\?\.\(\)\)/);
});

test("legacy devices do not repeat onboarding and explicit re-enabling remains available", () => {
  const main = readFileSync(new URL("../packaged-guest/main.tsx", import.meta.url), "utf8");
  assert.match(main, /setPermissionOfferSeen\(localStorage.getItem\(PERMISSION_OFFER_SEEN_KEY\) === "1" \|\| saved !== null\)/);
  assert.match(main, /localStorage\.setItem\(PERMISSION_OFFER_SEEN_KEY, "1"\)/);
  assert.match(main, /if \(current\.display === "denied"\)/); // confirmed action may navigate to Android settings
  assert.match(main, /deviceSettings\?\.openNotificationSettings\(\)/);
  assert.match(main, /const onEnabledChange = useCallback\(async \(next: boolean\)/);
  assert.match(main, /LocalNotifications\.requestPermissions\(\)/);
  const first = { permission: "prompt", seen: false, explicitlyDisabled: false };
  assert.equal(shouldShowPermissionOffer(first), true);
  for (const state of [
    { ...first, seen: true },
    { ...first, explicitlyDisabled: true },
    { ...first, permission: "granted" },
    { ...first, permission: "denied" },
    { ...first, permission: "unknown" },
  ]) {
    assert.equal(shouldShowPermissionOffer(state), false);
  }
});
