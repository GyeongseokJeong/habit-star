import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const config = readFileSync(resolve(root, "capacitor.config.ts"), "utf8");
const source = readFileSync(resolve(root, "notifications/main.js"), "utf8");
const html = readFileSync(resolve(root, "notifications/index.html"), "utf8");
const prep = readFileSync(resolve(root, "scripts/prepare-notification-poc.mjs"), "utf8");

test("test APK has isolated Android package and cannot combine remote mode", () => {
  assert.match(config, /byeolharu\.notificationpoc/);
  assert.match(config, /remoteDebug && notificationsPoc/);
  assert.match(prep, /BYEOLHARU_POC_NOTIFICATIONS/);
});
test("notification operations require explicit user taps and avoid existing web data", () => {
  assert.match(source, /requestPermissions\(\)/);
  assert.match(source, /LocalNotifications\.schedule\(/);
  assert.match(source, /LocalNotifications\.cancel\(/);
  assert.match(source, /30_000/);
  assert.match(source, /isExactNotification: false/, "PoC must not request exact alarm settings");
  assert.doesNotMatch(source, /indexedDB|supabase|fetch\(|localStorage|service_role/);
  assert.match(html, /id="permission"/);
  assert.match(html, /id="schedule"/);
  assert.match(html, /id="cancel"/);
});

test("STEP 5 is a separate package with bundled assets, not remote website mode", () => {
  assert.match(config, /byeolharu\.reminderstep5/);
  assert.match(config, /reminderStep5 && !notificationsPoc/);
  assert.match(prep, /reminder-step5-main\.js/);
  assert.match(prep, /reminder-step5\.html/);
});

test("STEP 8 APK uses a separate package and a bundled opt-in demo", () => {
  const lab = readFileSync(resolve(root, "notifications/reminder-step8-main.js"), "utf8");
  const html = readFileSync(resolve(root, "notifications/reminder-step8.html"), "utf8");
  assert.match(config, /byeolharu\.integrationstep8/);
  assert.match(config, /integrationStep8 && \(!notificationsPoc \|\| reminderStep5 \|\| remoteDebug\)/);
  assert.match(prep, /notifications\/reminder-step8-main\.js/);
  assert.match(prep, /notifications\/reminder-step8\.html/);
  assert.match(lab, /optIn=false|optIn = false/);
  assert.match(lab, /LocalNotifications\.checkPermissions/);
  assert.match(lab, /lifecycle\.disable\(\)/);
  assert.match(lab, /lifecycle\.sync\(context\(\)\)/);
  assert.doesNotMatch(lab.replace(/\/\/[^\n]*/g, ""), /localStorage|indexedDB|supabase|fetch\(|getUser\(/);
  assert.match(html, /id="activate"/);
  assert.match(html, /id="completed"/);
  assert.match(html, /id="disable"/);
});
