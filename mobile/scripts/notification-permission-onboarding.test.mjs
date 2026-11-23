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
