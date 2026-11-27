import test from "node:test";
import assert from "node:assert/strict";
import { buildInfoFor } from "./build-info.mjs";
import { validateWidgetManifest } from "./check-guest-boot-manifest.mjs";
import { parseApkBadging, parseBundleDebuggable, verifyArtifactMetadata, verifyPackagedAssetBytes } from "./check-android-artifact.mjs";

function fixture(variant, kind) {
  const expected = buildInfoFor({ code: 7, name: "0.2.0" }, "a".repeat(40), true, variant);
  const prefix = kind === "aab" ? "base/assets/public/" : "assets/public/";
  return {
    expected, embedded: { ...expected }, kind,
    metadata: { applicationId: expected.applicationId, versionCode: "7", versionName: "0.2.0", minSdk: "24", targetSdk: "36", debuggable: variant === "debug", label: variant === "debug" ? "별하루 비회원 STEP 9" : "별하루" },
    assets: ["app.js", "app.css", "index.html", "build-info.json", ...(variant === "debug" ? ["widget-cold-runtime.js"] : [])].map(name => prefix + name),
  };
}

test("APK and AAB metadata and packaged provenance validate for the matching variant", () => {
  for (const args of [fixture("debug", "apk"), fixture("release", "apk"), fixture("release", "aab")]) verifyArtifactMetadata(args);
});

test("final package, version, SDK, label, SHA and variant discrepancies fail", () => {
  for (const [key, value] of Object.entries({applicationId:"wrong", versionCode:"8", versionName:"1.0.0", minSdk:"25", targetSdk:"35", label:"wrong"})) {
    const args = fixture("release", "apk");
    args.metadata[key] = value;
    assert.throws(() => verifyArtifactMetadata(args), /mismatch/);
  }
  for (const [key, value] of Object.entries({sourceSha:"b".repeat(40), variant:"debug", versionCode:8, version:"1.0.0"})) {
    const args = fixture("release", "aab");
    args.embedded[key] = value;
    assert.throws(() => verifyArtifactMetadata(args), /Embedded build-info/);
  }
});

test("stale experimental release runtime, missing or duplicate required assets fail closed", () => {
  const release = fixture("release", "aab");
  release.assets.push("base/assets/public/widget-cold-runtime.js");
  assert.throws(() => verifyArtifactMetadata(release), /Debug/);
  const debug = fixture("debug", "apk");
  debug.assets.pop();
  assert.throws(() => verifyArtifactMetadata(debug), /Debug/);
  const missing = fixture("release", "apk");
  missing.assets.pop();
  assert.throws(() => verifyArtifactMetadata(missing), /Missing or duplicate/);
  const duplicate = fixture("release", "apk");
  duplicate.assets.push(duplicate.assets[0]);
  assert.throws(() => verifyArtifactMetadata(duplicate), /Missing or duplicate/);
});

test("final manifest must enforce the variant's native widget debug guard", () => {
  for (const [variant, kind] of [["debug", "apk"], ["release", "apk"], ["release", "aab"]]) {
    const args = fixture(variant, kind);
    args.metadata.debuggable = variant !== "debug";
    assert.throws(() => verifyArtifactMetadata(args), /debuggable mismatch/);
    delete args.metadata.debuggable;
    assert.throws(() => verifyArtifactMetadata(args), /debuggable mismatch/);
  }
  assert.equal(parseBundleDebuggable(""), false);
  assert.equal(parseBundleDebuggable("false"), false);
  assert.equal(parseBundleDebuggable("true"), true);
  for (const invalid of ["False", "1", "@bool/flag", "false\ntrue", undefined]) {
    assert.throws(() => parseBundleDebuggable(invalid), /Unexpected AAB/);
  }
});

test("same-job generated assets must match actual archive bytes in both variants", () => {
  for (const [variant, kind] of [["debug", "apk"], ["release", "apk"], ["release", "aab"]]) {
    const args = fixture(variant, kind);
    const files = new Map(args.assets.map(path => [path, Buffer.from("expected:" + path.split("/").at(-1))]));
    const staged = file => Buffer.from("expected:" + file);
    const check = () => verifyPackagedAssetBytes({ kind, variant, readEmbedded: path => files.get(path), readStaged: staged });
    check();
    for (const [path, original] of files) {
      files.set(path, Buffer.from("stale"));
      assert.throws(check, /Stale or altered packaged bytes/);
      files.set(path, Buffer.alloc(0));
      assert.throws(check, /Stale or altered packaged bytes/);
      files.set(path, undefined);
      assert.throws(check, /Missing or empty packaged bytes/);
      files.set(path, original);
    }
  }
});

test("parse actual aapt badging shape and reject missing values", () => {
  const expected = fixture("release", "apk").metadata;
  const badging = "package: name='app.byeolharu.android' versionCode='7' versionName='0.2.0' platformBuildVersionName='16'\n"
    + "sdkVersion:'24'\ntargetSdkVersion:'36'\napplication-label:'별하루'\n";
  assert.deepEqual(parseApkBadging(badging), expected);
  assert.equal(parseApkBadging(badging + "application-debuggable\n").debuggable, true);
  assert.equal(parseApkBadging(badging + "other-application-debuggable\n").debuggable, false);
  assert.throws(() => parseApkBadging(badging.replace("targetSdkVersion:'36'\n", "")), /Missing APK targetSdk/);
});

test("compiled APK widget components must stay private except the configuration activity", () => {
  const make = (type, name, flag, extras = "") =>
    '    E: ' + type + ' (line=1)\n' +
    '      A: android:name(0x01010003)="app.byeolharu.android.' + name + '" (Raw: "app.byeolharu.android.' + name + '")\n' +
    (flag === null ? "" : '      A: android:exported(0x01010010)=(type 0x12)' + flag + '\n') + extras;
  const permission = '      A: android:permission(0x01010006)="android.permission.BIND_REMOTEVIEWS" (Raw: "android.permission.BIND_REMOTEVIEWS")\n';
  const app = make("application", "ByeolharuWidgetApplication", null);
  const mini = make("receiver", "ByeolharuWidgetProvider$Mini", "0x0");
  const compact = make("receiver", "ByeolharuWidgetProvider$Compact", "0x0");
  const activity = make("activity", "ByeolharuWidgetConfigActivity", "0xffffffff");
  const service = make("service", "ByeolharuWidgetListService", "0x0", permission);
  const manifest = app + mini + compact + activity + service;
  assert.equal(validateWidgetManifest(manifest), true);
  assert.throws(() => validateWidgetManifest(manifest.replace(mini, "")), /two widget providers/);
  assert.throws(() => validateWidgetManifest(manifest + compact), /two widget providers/);
  assert.throws(() => validateWidgetManifest(manifest.replace(mini, mini.replace("0x0\n", "0xffffffff\n"))), /exported mismatch/);
  assert.throws(() => validateWidgetManifest(manifest.replace(activity, activity.replace("0xffffffff", "0x0"))), /exported mismatch/);
  assert.throws(() => validateWidgetManifest(manifest.replace(permission, "")), /binding permission/);
  assert.throws(() => validateWidgetManifest(manifest.replace(service, service + '      A: android:process(0x01010011)=":other"\n')), /application process/);
  assert.throws(() => validateWidgetManifest(manifest.replace(service, make("service", "ByeolharuWidgetListService", null, permission))), /exported flag/);
});
