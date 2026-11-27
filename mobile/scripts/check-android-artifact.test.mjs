import test from "node:test";
import assert from "node:assert/strict";
import { buildInfoFor } from "./build-info.mjs";
import { parseApkBadging, verifyArtifactMetadata } from "./check-android-artifact.mjs";

function fixture(variant, kind) {
  const expected = buildInfoFor({ code: 7, name: "0.2.0" }, "a".repeat(40), true, variant);
  const prefix = kind === "aab" ? "base/assets/public/" : "assets/public/";
  return {
    expected, embedded: { ...expected }, kind,
    metadata: { applicationId: expected.applicationId, versionCode: "7", versionName: "0.2.0", minSdk: "24", targetSdk: "36", label: variant === "debug" ? "별하루 비회원 STEP 9" : "별하루" },
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

test("parse actual aapt badging shape and reject missing values", () => {
  const expected = fixture("release", "apk").metadata;
  const badging = "package: name='app.byeolharu.android' versionCode='7' versionName='0.2.0' platformBuildVersionName='16'\n"
    + "sdkVersion:'24'\ntargetSdkVersion:'36'\napplication-label:'별하루'\n";
  assert.deepEqual(parseApkBadging(badging), expected);
  assert.throws(() => parseApkBadging(badging.replace("targetSdkVersion:'36'\n", "")), /Missing APK targetSdk/);
});
