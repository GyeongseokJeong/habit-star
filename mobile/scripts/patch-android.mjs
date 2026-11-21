/**
 * Patch Capacitor's generated debug MainActivity after `cap add android`.
 * Keeping the native template separate avoids committing disposable Gradle
 * output during PoC; a future release must commit the native Android project.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

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
  writeFileSync(returnManifestPath, returnManifest);
}
