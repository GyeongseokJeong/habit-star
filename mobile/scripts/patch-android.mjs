/**
 * Patch Capacitor's generated debug MainActivity after `cap add android`.
 * Keeping the native template separate avoids committing disposable Gradle
 * output during PoC; a future release must commit the native Android project.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { applyLauncherIcons } from "./generate-launcher-icons.mjs";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(mobileRoot, "android/app/src/main/java");
const template = readFileSync(resolve(mobileRoot, "native/MainActivity.java.template"), "utf8");

function findActivityFiles(folder) {
  const found = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...findActivityFiles(file));
    else if (entry.isFile() && entry.name === "MainActivity.java") found.push(file);
  }
  return found;
}

const files = findActivityFiles(sourceRoot);
assert.equal(files.length, 1, "Expected exactly one generated MainActivity.java");
const path = files[0];
const current = readFileSync(path, "utf8");
const match = current.match(/^package ([a-zA-Z_][a-zA-Z_0-9]*(?:\.[a-zA-Z_][a-zA-Z_0-9]*)*);/m);
assert.ok(match, "Could not read the generated Android package name");
assert.ok(current.includes("extends BridgeActivity"), "Unexpected activity template; refusing patch");
const targetPackage = match[1];
assert.equal(
  targetPackage,
  process.env.BYEOLHARU_ANDROID_RELEASE === "1"
    ? "app.byeolharu.android"
    : "io.github.gyeongseokjeong.byeolharu.packagedgueststep9",
  "Refusing to patch another Android package",
);
assert.ok(template.includes("__PACKAGE__"), "Missing package placeholder in native template");
const patched = template
  .replace("__PACKAGE__", targetPackage)
  .replace("__GUEST_SETTINGS_PLUGIN_REGISTER__", "registerPlugin(ByeolharuDeviceSettingsPlugin.class);");
assert.ok(!patched.includes("__PACKAGE__"));
assert.ok(!patched.includes("__GUEST_SETTINGS_PLUGIN_REGISTER__"));
if (current !== patched) writeFileSync(path, patched);
const pluginTemplate = readFileSync(
  resolve(mobileRoot, "native/ByeolharuDeviceSettingsPlugin.java.template"),
  "utf8",
);
assert.ok(pluginTemplate.includes("__PACKAGE__"), "Missing notification settings plugin package placeholder");
const pluginPath = join(dirname(path), "ByeolharuDeviceSettingsPlugin.java");
writeFileSync(pluginPath, pluginTemplate.replaceAll("__PACKAGE__", targetPackage));
console.log(`Android native PoC activity patched for ${targetPackage}`);

// Navigate back to the existing test app after email, without transferring tokens.

const returnManifestPath = resolve(mobileRoot, "android/app/src/main/AndroidManifest.xml");
let returnManifest = readFileSync(returnManifestPath, "utf8");
const initialManifest = returnManifest;
const returnFilter = `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="byeolharu-return" android:host="auth" android:path="/return" />
            </intent-filter>
`;
const activityPattern = /(<activity\b[^>]*android:name="\.MainActivity"[^>]*>)([\s\S]*?)(<\/activity>)/;
const activity = returnManifest.match(activityPattern);
assert.ok(activity, "Missing MainActivity in generated Android manifest");
assert.ok(activity[1].includes('android:exported="true"'), "Return activity must be exported");
if (!activity[2].includes('android:scheme="byeolharu-return"')) {
  returnManifest = returnManifest.replace(activityPattern, (_, start, body, end) => start + body + "\n" + returnFilter + end);
}
// User-controlled exact-alarm special access, never the restricted USE_EXACT_ALARM.
if (!returnManifest.includes("android.permission.SCHEDULE_EXACT_ALARM")) {
  const header = returnManifest.match(/<manifest\b[^>]*>/);
  assert.ok(header, "Missing Android manifest root");
  returnManifest = returnManifest.replace(header[0],
    header[0] + '\n    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />');
}
// Read-only widget resources, installed for both validated app IDs.
const widgetNative = resolve(mobileRoot, "native/widgets");
const mainRoot = resolve(mobileRoot, "android/app/src/main");
writeFileSync(join(dirname(path), "ByeolharuWidgetProvider.java"),
  readFileSync(join(widgetNative, "ByeolharuWidgetProvider.java.template"), "utf8").replaceAll("__PACKAGE__", targetPackage));
for (const folder of ["layout", "xml", "drawable"]) {
  const dest = join(mainRoot, "res", folder);
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(join(widgetNative, folder))) copyFileSync(join(widgetNative, folder, file), join(dest, file));
}
const artFolder = join(mainRoot, "res", "drawable-nodpi");
mkdirSync(artFolder, { recursive: true });
for (let stage = 1; stage <= 6; stage++) {
  copyFileSync(resolve(mobileRoot, "../public/assets/constellation", `stage-0${stage}.webp`),
    join(artFolder, `byeolharu_widget_stage_${stage}.webp`));
}
for (const [name, resource, label] of [
  ["Growth", "byeolharu_widget_growth_info", "별하루 · 별빛 성장"],
  ["Practice", "byeolharu_widget_practice_info", "별하루 · 오늘의 실천"],
]) {
  const receiver = ".ByeolharuWidgetProvider$" + name;
  if (!returnManifest.includes(`android:name="${receiver}"`)) {
    assert.ok(returnManifest.includes("</application>"), "Missing Android application");
    returnManifest = returnManifest.replace("</application>", `
        <receiver android:name="${receiver}" android:exported="false" android:label="${label}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="android.intent.action.DATE_CHANGED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/${resource}" />
        </receiver>
    </application>`);
  }
}
if (returnManifest !== initialManifest) writeFileSync(returnManifestPath, returnManifest);

if (process.env.BYEOLHARU_ANDROID_RELEASE === "1") {
  const { code, name } = JSON.parse(readFileSync(resolve(mobileRoot, "release-version.json"), "utf8"));
  assert.ok(Number.isSafeInteger(code) && code > 0 && code <= 2100000000, "Invalid Android versionCode");
  assert.match(name, /^\d+\.\d+\.\d+$/, "Expected a numeric release version");
  const gradlePath = resolve(mobileRoot, "android/app/build.gradle");
  const gradle = readFileSync(gradlePath, "utf8");
  assert.equal((gradle.match(/^\s*versionCode \d+\s*$/gm) || []).length, 1, "Expected one default versionCode");
  assert.equal((gradle.match(/^\s*versionName "[^"]+"\s*$/gm) || []).length, 1, "Expected one default versionName");
  writeFileSync(gradlePath, gradle.replace(/(\bversionCode )\d+/, (_, prefix) => prefix + code).replace(/(\bversionName )"[^"]+"/, '$1"' + name + '"'));
}

// Replace Capacitor's default launcher icon in both debug and release variants.
applyLauncherIcons(resolve(mobileRoot, "android/app/src/main"));
