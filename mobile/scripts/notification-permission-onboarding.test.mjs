import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  permissionStateFromAndroid, exactPermissionStateFromAndroid, shouldShowPermissionOffer,
  startupPermissionOffer, readDeviceReminderPermissions, requestHabitReminderPermission,
} from "../notifications/notification-permission-onboarding.js";

test("Android permission states keep prompts, known blocks, grants and unknown separate", () => {
  for (const [raw, expected] of [
    ["granted", "granted"], ["prompt", "prompt"], ["prompt-with-rationale", "prompt"],
    ["denied", "denied"], ["unexpected", "unknown"], [undefined, "unknown"],
  ]) assert.equal(permissionStateFromAndroid(raw), expected);
  assert.equal(exactPermissionStateFromAndroid("granted"), "granted");
  assert.equal(exactPermissionStateFromAndroid("denied"), "denied");
  for (const raw of [undefined, "unexpected", "prompt"]) assert.equal(exactPermissionStateFromAndroid(raw), "unknown");
});

test("initial empty-install check reads both permissions independently and never requests", async () => {
  for (const [display, exact, expected] of [
    ["prompt", "denied", { permissionState: "prompt", exactPermission: "denied" }],
    [new Error("display"), "granted", { permissionState: "unknown", exactPermission: "granted" }],
    ["granted", new Error("exact"), { permissionState: "granted", exactPermission: "unknown" }],
    ["unexpected", "unexpected", { permissionState: "unknown", exactPermission: "unknown" }],
  ]) {
    const calls = [];
    const result = await readDeviceReminderPermissions({
      async checkPermissions() {
        calls.push("display");
        if (display instanceof Error) throw display;
        return { display };
      },
      async checkExactNotificationSetting() {
        calls.push("exact");
        if (exact instanceof Error) throw exact;
        return { exact_alarm: exact };
      },
      requestPermissions() { assert.fail("must not request"); },
      changeExactNotificationSetting() { assert.fail("must not open settings"); },
    });
    assert.deepEqual(result, expected);
    assert.deepEqual(calls.sort(), ["display", "exact"]);
  }
});

const restored = {
  permission: "prompt", exactPermission: "denied", seen: false, ready: true,
  habitIntent: true, explicitlyDisabled: false, wrapupEnabled: false,
};
test("restored timed habit ON triggers one startup offer regardless of legacy device preference", () => {
  assert.equal(startupPermissionOffer(restored), "display");
  assert.equal(startupPermissionOffer({ ...restored, permission: "denied" }), "display");
  assert.equal(startupPermissionOffer({ ...restored, permission: "granted" }), "exact");
  assert.equal(startupPermissionOffer({ ...restored, permission: "granted", exactPermission: "granted" }), null);
  assert.equal(startupPermissionOffer({ ...restored, permission: "granted", exactPermission: "unknown" }), null);
  assert.equal(startupPermissionOffer({ ...restored, permission: "unknown" }), null);
  for (const patch of [
    { seen: true }, { seen: undefined }, { ready: false },
    { habitIntent: false }, { explicitlyDisabled: true },
  ]) assert.equal(startupPermissionOffer({ ...restored, ...patch }), null);
  assert.equal(startupPermissionOffer({
    ...restored, habitIntent: false, explicitlyDisabled: true, wrapupEnabled: true,
  }), "display");
});

test("later related actions offer POST permission recovery even after dismissal or device OFF", () => {
  for (const permission of ["prompt", "denied"]) {
    assert.equal(shouldShowPermissionOffer({ permission, seen: true, explicitlyDisabled: true }), true);
  }
  for (const permission of ["granted", "unknown"]) assert.equal(shouldShowPermissionOffer({ permission }), false);
});

function permissionBridge(before, after) {
  const calls = [];
  const bridge = {
    async checkPermissions() {
      calls.push("check");
      if (before instanceof Error) throw before;
      return { display: before };
    },
    async requestPermissions() {
      calls.push("request");
      if (after instanceof Error) throw after;
      return { display: after };
    },
  };
  return { bridge, calls };
}

test("already granted skips a duplicate OS request; checked state can be reused", async () => {
  const { bridge, calls } = permissionBridge("granted", new Error("must not request"));
  assert.deepEqual(await requestHabitReminderPermission(bridge), { permission: "granted", route: "enable" });
  assert.deepEqual(calls, ["check"]);
  assert.deepEqual(await requestHabitReminderPermission(bridge, "granted"), { permission: "granted", route: "enable" });
  assert.deepEqual(calls, ["check"]);
});

test("first or rationale prompt requests once, never routes a fresh denial or dismissal to Settings", async () => {
  for (const before of ["prompt", "prompt-with-rationale"]) {
    for (const [after, permission, route] of [
      ["granted", "granted", "enable"],
      ["denied", "denied", "declined"],
      ["prompt", "prompt", "declined"],
      ["prompt-with-rationale", "prompt", "declined"],
    ]) {
      const { bridge, calls } = permissionBridge(before, after);
      assert.deepEqual(await requestHabitReminderPermission(bridge), { permission, route });
      assert.deepEqual(calls, ["check", "request"]);
    }
  }
});

test("a later deliberate action after a confirmed block offers Settings without another OS request", async () => {
  const { bridge, calls } = permissionBridge("denied", new Error("must not request"));
  assert.deepEqual(await requestHabitReminderPermission(bridge), { permission: "denied", route: "settings" });
  assert.deepEqual(calls, ["check"]);
  assert.deepEqual(await requestHabitReminderPermission(bridge, "denied"), { permission: "denied", route: "settings" });
  assert.deepEqual(calls, ["check"]);
});

test("unknown permissions and bridge errors do not trigger settings", async () => {
  for (const [before, after, expectedCalls] of [
    [new Error("unavailable"), "granted", ["check"]],
    ["unexpected", "granted", ["check"]],
    ["prompt", new Error("unavailable"), ["check", "request"]],
    ["prompt", "unexpected", ["check", "request"]],
  ]) {
    const { bridge, calls } = permissionBridge(before, after);
    assert.deepEqual(await requestHabitReminderPermission(bridge), { permission: "unknown", route: "retry" });
    assert.deepEqual(calls, expectedCalls);
  }
});

test("native permission checks, startup offer, scope readiness and later recovery stay in the Android entrypoint", () => {
  const native = readFileSync(new URL("../packaged-guest/main.tsx", import.meta.url), "utf8");
  const website = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../../components/byeolharu.tsx", import.meta.url), "utf8");
  assert.match(native, /readDeviceReminderPermissions\(LocalNotifications\)/);
  assert.match(native, /void refreshPermission\(\)/);
  assert.match(native, /isReminderSnapshotReady\(next, memberUserId\)/);
  assert.match(native, /snapshot\.current = ready \? next : null/);
  assert.match(native, /startupPermissionOffer: startupOffer/);
  assert.match(native, /onDismissStartupPermissionOffer: dismissPermissionOffer/);
  assert.match(native, /localStorage\.setItem\(PERMISSION_OFFER_SEEN_KEY, "1"\)/);
  assert.match(native, /permissionRevision\.current === revision/);
  assert.match(native, /attemptDisplayPermission/);
  assert.match(native, /changeExactNotificationSetting\(\)/);
  assert.match(ui, /onCheckNativePermissions=/);
  assert.match(ui, /startupPermissionOffer/);
  assert.doesNotMatch(website, /notification-permission-onboarding|LocalNotifications/);
  assert.doesNotMatch(ui, /className="android-permission-invite"/);
});
