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

function main() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  assert.ok(sdk, "ANDROID_HOME/ANDROID_SDK_ROOT is required for APK inspection");
  const aapt = resolve(sdk, "build-tools/36.0.0/aapt");
  const apk = resolve(import.meta.dirname, "../android/app/build/outputs/apk/debug/app-debug.apk");
  assert.ok(existsSync(aapt), "Android build tools 36.0.0 aapt not installed");
  assert.ok(existsSync(apk), "Packaged guest APK is missing: " + apk);
  const dump = execFileSync(aapt, ["dump", "xmltree", apk, "AndroidManifest.xml"], {encoding:"utf8",maxBuffer:12*1024*1024});
  validateNotificationManifest(dump);
  validateColdReminderProcessManifest(dump);
  for (const token of ["byeolharu-return", "android.intent.category.BROWSABLE", "/return"]) {
    assert.ok(dump.includes(token), "Compiled APK missing Android return intent: " + token);
  }
  console.log("PASS: compiled guest APK contains boot receiver, required notification permissions and same-process cold alarm components");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
