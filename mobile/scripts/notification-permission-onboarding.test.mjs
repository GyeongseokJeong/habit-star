import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  permissionStateFromAndroid, exactPermissionStateFromAndroid, shouldShowPermissionOffer,
  startupPermissionOffer, readDeviceReminderPermissions, requestHabitReminderPermission, runReminderPermissionSetup,
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
  assert.equal(startupPermissionOffer(restored), "setup");
  assert.equal(startupPermissionOffer({ ...restored, permission: "denied" }), "setup");
  assert.equal(startupPermissionOffer({ ...restored, permission: "granted" }), "setup");
  assert.equal(startupPermissionOffer({ ...restored, permission: "granted", exactPermission: "granted" }), null);
  assert.equal(startupPermissionOffer({ ...restored, permission: "granted", exactPermission: "unknown" }), null);
  assert.equal(startupPermissionOffer({ ...restored, permission: "unknown" }), null);
  for (const patch of [
    { seen: true }, { seen: undefined }, { ready: false },
    { habitIntent: false }, { explicitlyDisabled: true },
  ]) assert.equal(startupPermissionOffer({ ...restored, ...patch }), null);
  assert.equal(startupPermissionOffer({
    ...restored, habitIntent: false, explicitlyDisabled: true, wrapupEnabled: true,
  }), "setup");
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
  assert.match(native, /runReminderPermissionSetup/);
  assert.match(native, /permissionScopeRevision\.current === revision/);
  assert.match(native, /App\.getState\(\)/);
  assert.doesNotMatch(native, /onRequestExactPermission/);
  assert.match(ui, /onCheckNativePermissions=/);
  assert.match(ui, /startupPermissionOffer/);
  assert.doesNotMatch(website, /notification-permission-onboarding|LocalNotifications/);
  assert.doesNotMatch(ui, /className="android-permission-invite"/);
});

function setupBridge({ display = "prompt", exact = "denied", displayReturn = "granted", exactReturn = "granted",
  settingsReturn = "granted", exactError = false, displayError = false } = {}) {
  const events = [];
  let alive = true;
  let foreground = true;
  const state = () => ({ permissionState: display, exactPermission: exact });
  const localNotifications = {
    async requestPermissions() {
      events.push("request-display");
      display = displayReturn;
      return { display };
    },
    async changeExactNotificationSetting() {
      events.push("open-exact");
      if (exactError) throw Error("cannot open exact settings");
      exact = exactReturn;
    },
  };
  const config = {
    localNotifications,
    read: async () => state(),
    openDisplaySettings: async () => {
      events.push("open-display-settings");
      if (displayError) throw Error("cannot open display settings");
      display = settingsReturn;
    },
    checkForeground: async () => foreground,
    waitForForeground: async () => foreground,
    isCurrent: () => alive,
  };
  return { events, config, invalidate: () => { alive = false; },
    background: () => { foreground = false; }, setDisplay: value => { display = value; },
    setExact: value => { exact = value; } };
}

test("single CTA: request only missing permissions, with optional exact access", async () => {
  const cases = [
    [{}, ["request-display", "open-exact"], "complete", true],
    [{ display: "granted" }, ["open-exact"], "complete", true],
    [{ exact: "granted" }, ["request-display"], "complete", true],
    [{ display: "granted", exact: "granted" }, [], "complete", true],
    [{ exactReturn: "denied" }, ["request-display", "open-exact"], "ordinary", true],
    [{ exactError: true }, ["request-display", "open-exact"], "exact-error", true],
    [{ exactReturn: "unknown" }, ["request-display", "open-exact"], "exact-unknown", true],
    [{ exact: "unknown" }, ["request-display"], "exact-unknown", true],
    [{ displayReturn: "denied" }, ["request-display"], "declined", false],
    [{ displayReturn: "prompt" }, ["request-display"], "declined", false],
    [{ display: "unknown" }, [], "retry", false],
    [{ display: "denied", settingsReturn: "denied" }, ["open-display-settings"], "declined", false],
    [{ display: "denied" }, ["open-display-settings", "open-exact"], "complete", true],
    [{ display: "denied", displayError: true }, ["open-display-settings"], "settings-error", false],
    [{ display: "denied", exact: "granted" }, ["open-display-settings"], "complete", true],
  ];
  for (const [options, events, status, displayGranted] of cases) {
    const bridge = setupBridge(options);
    assert.deepEqual(await runReminderPermissionSetup(bridge.config), { status, displayGranted }, JSON.stringify(options));
    assert.deepEqual(bridge.events, events, JSON.stringify(options));
  }
});

test("normal settings activity must actually return and re-read a grant before exact settings", async () => {
  const bridge = setupBridge({ display: "denied" });
  let finish;
  let launched;
  const returned = new Promise(resolve => { finish = resolve; });
  const started = new Promise(resolve => { launched = resolve; });
  bridge.config.openDisplaySettings = async () => {
    bridge.events.push("open-display-settings");
    launched();
    await returned;
    bridge.setDisplay("granted");
  };
  const setup = runReminderPermissionSetup(bridge.config);
  await started;
  assert.deepEqual(bridge.events, ["open-display-settings"]);
  finish();
  assert.deepEqual(await setup, { status: "complete", displayGranted: true });
  assert.deepEqual(bridge.events, ["open-display-settings", "open-exact"]);
});

test("auth/UI invalidation or failure to return to foreground prevents chaining exact access", async () => {
  for (const stop of ["invalidate", "background"]) {
    const bridge = setupBridge({ display: "denied" });
    const open = bridge.config.openDisplaySettings;
    bridge.config.openDisplaySettings = async () => { await open(); bridge[stop](); };
    assert.deepEqual(await runReminderPermissionSetup(bridge.config), { status: "interrupted", displayGranted: false });
    assert.deepEqual(bridge.events, ["open-display-settings"]);
  }
  const bridge = setupBridge();
  const request = bridge.config.localNotifications.requestPermissions;
  bridge.config.localNotifications.requestPermissions = async () => {
    const result = await request();
    bridge.invalidate();
    return result;
  };
  assert.equal((await runReminderPermissionSetup(bridge.config)).status, "interrupted");
  assert.deepEqual(bridge.events, ["request-display"]);
});

test("a POST callback alone is not a grant and display revocation during exact settings is not success", async () => {
  const bridge = setupBridge();
  bridge.config.localNotifications.requestPermissions = async () => ({ display: "granted" });
  assert.deepEqual(await runReminderPermissionSetup(bridge.config), { status: "declined", displayGranted: false });
  assert.deepEqual(bridge.events, []);
  const duringExact = setupBridge({ display: "granted" });
  const exact = duringExact.config.localNotifications.changeExactNotificationSetting;
  duringExact.config.localNotifications.changeExactNotificationSetting = async () => { await exact(); duringExact.setDisplay("denied"); };
  assert.deepEqual(await runReminderPermissionSetup(duringExact.config), { status: "declined", displayGranted: false });
});

test("blocked-display native bridge awaits an ActivityResult and never trusts a result code", () => {
  const java = readFileSync(new URL("../native/ByeolharuDeviceSettingsPlugin.java.template", import.meta.url), "utf8");
  const method = java.slice(java.indexOf("public void openNotificationSettings"));
  assert.match(method, /startActivityForResult\(call, intent, "onNotificationSettingsReturned"\)/);
  assert.match(method, /@ActivityCallback\s+private void onNotificationSettingsReturned/);
  assert.match(method, /if \(call != null\) call.resolve\(\)/);
  assert.doesNotMatch(method, /intent.addFlags|result.getResultCode|getContext\(\).startActivity/);
});

test("foreground loss during a permission bridge read cannot open another OS screen", async () => {
  for (const [dropAfterRead, expected] of [[1, []], [2, ["request-display"]]]) {
    const bridge = setupBridge();
    const read = bridge.config.read;
    let reads = 0;
    bridge.config.read = async () => {
      const result = await read();
      if (++reads === dropAfterRead) bridge.background();
      return result;
    };
    assert.deepEqual(await runReminderPermissionSetup(bridge.config), { status: "interrupted", displayGranted: false });
    assert.deepEqual(bridge.events, expected);
  }
});
