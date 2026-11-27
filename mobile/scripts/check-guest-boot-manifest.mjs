/**
 * Inspect the final compiled Android APK, not merely the source manifest.
 *
 * Capacitor Local Notifications v8 bundles a BootReceiver via library manifest
 * merging. The job must fail if a future plugin/update/manifest merge drops
 * that receiver or notification-related permissions.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validateNotificationManifest(tree) {
  assert.equal(typeof tree, "string", "Android manifest dump must be text");
  const required = [
    ["boot restore receiver", "com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver"],
    ["device reboot action", "android.intent.action.BOOT_COMPLETED"],
    ["locked boot action", "android.intent.action.LOCKED_BOOT_COMPLETED"],
    ["boot completed permission", "android.permission.RECEIVE_BOOT_COMPLETED"],
    ["notification display permission", "android.permission.POST_NOTIFICATIONS"],
    ["exact alarm special access", "android.permission.SCHEDULE_EXACT_ALARM"],
  ];
  for (const [label, token] of required) {
    assert.ok(tree.includes(token), "Packaged Android APK is missing " + label + ": " + token);
  }
  // The plugin, not the app's WebView JS, registers the reboot receiver.
  const index = tree.indexOf("LocalNotificationRestoreReceiver");
  const nextReceiver = tree.indexOf("E: receiver", index + 1);
  const section = tree.slice(index, nextReceiver < 0 ? undefined : nextReceiver);
  assert.ok(section.includes("android.intent.action.BOOT_COMPLETED"),
    "Boot action must be on the Local Notifications restore receiver");
  return true;
}

/** The cold adapter serializes with the pinned plugin receivers on the
 * application's main thread, not a second application process. */
export function validateColdReminderProcessManifest(tree) {
  const sections=tree.split(/\n(?=\s*E: )/);
  const components=sections.filter(section=>/^\s*E: (application|activity|receiver|service)(?:\s|$)/.test(section));
  const required=["E: application","MainActivity","ByeolharuWidgetProvider",
    "TimedNotificationPublisher","NotificationDismissReceiver","LocalNotificationRestoreReceiver"];
  for (const label of required) {
    const matches=components.filter(section=>section.includes(label));
    assert.ok(matches.length>0,"Cold reminder component missing: "+label);
    for (const section of matches) assert.ok(!/A: android:process(?:\(|\s|=)/.test(section),
      "Cold reminder component must use the application process: "+label);
  }
  return true;
}

/** Inspect the compiled receiver/service exposure, not the source template.
 * aapt xmltree lists each element followed by its own attribute lines. */
export function validateWidgetManifest(tree) {
  const sections = tree.split(/\n(?=\s*E: )/);
  const nodes = sections.filter(section => /^\s*E: (application|activity|receiver|service)(?:\s|$)/.test(section));
  const stringAttr = (node, attr) => {
    const matches = [...node.matchAll(new RegExp('^\\s*A: android:' + attr + '(?:\\(0x[0-9a-f]+\\))?="([^"]*)"', 'gmi'))];
    assert.ok(matches.length <= 1, "Duplicate Android attribute: " + attr);
    return matches[0]?.[1];
  };
  const named = (type, name) => {
    const found = nodes.filter(node => new RegExp("^\\s*E: " + type + "(?:\\s|$)").test(node))
      .filter(node => {
        const actual = stringAttr(node, "name");
        return actual === name || actual?.endsWith("." + name);
      });
    assert.equal(found.length, 1, "Expected one widget component: " + name);
    return found[0];
  };
  const exported = (node, name, expected) => {
    const matches = [...node.matchAll(/^\s*A: android:exported(?:\(0x[0-9a-f]+\))?=\(type 0x12\)(0x[0-9a-f]+)\s*$/gmi)];
    assert.equal(matches.length, 1, "Missing/invalid widget exported flag: " + name);
    const value = Number(matches[0][1]);
    assert.ok(value === 0 || value === 1 || value === 0xffffffff, "Invalid widget exported value: " + name);
    assert.equal(value !== 0, expected, "Widget exported mismatch: " + name);
  };
  const application = named("application", "ByeolharuWidgetApplication");
  const providers = nodes.filter(node => /^\s*E: receiver(?:\s|$)/.test(node) &&
    /(?:^|\.)ByeolharuWidgetProvider\$/.test(stringAttr(node, "name") ?? ""));
  assert.equal(providers.length, 2, "Expected exactly two widget providers");
  const mini = named("receiver", "ByeolharuWidgetProvider$Mini");
  const compact = named("receiver", "ByeolharuWidgetProvider$Compact");
  const activity = named("activity", "ByeolharuWidgetConfigActivity");
  const service = named("service", "ByeolharuWidgetListService");
  exported(mini, "Mini", false);
  exported(compact, "Compact", false);
  exported(activity, "ConfigActivity", true);
  exported(service, "ListService", false);
  assert.equal(stringAttr(service, "permission"), "android.permission.BIND_REMOTEVIEWS",
    "Widget list service binding permission mismatch");
  for (const node of [application, mini, compact, activity, service])
    assert.ok(!/A: android:process(?:\(|\s|=)/.test(node), "Widget component must use application process");
  return true;
}

function main(filename) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  assert.ok(sdk, "ANDROID_HOME/ANDROID_SDK_ROOT is required for APK inspection");
  const aapt = resolve(sdk, "build-tools/36.0.0/aapt");
  const apk = filename ? resolve(filename) : resolve(import.meta.dirname, "../android/app/build/outputs/apk/debug/app-debug.apk");
  assert.ok(existsSync(aapt), "Android build tools 36.0.0 aapt not installed");
  assert.ok(existsSync(apk), "Packaged guest APK is missing: " + apk);
  const dump = execFileSync(aapt, ["dump", "xmltree", apk, "AndroidManifest.xml"], {encoding:"utf8",maxBuffer:12*1024*1024});
  validateNotificationManifest(dump);
  validateColdReminderProcessManifest(dump);
  validateWidgetManifest(dump);
  for (const token of ["byeolharu-return", "android.intent.category.BROWSABLE", "/return"]) {
    assert.ok(dump.includes(token), "Compiled APK missing Android return intent: " + token);
  }
  console.log("PASS: compiled APK contains boot receiver, notification permissions, same-process widget/alarm components and expected widget exposure");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv[2]);
