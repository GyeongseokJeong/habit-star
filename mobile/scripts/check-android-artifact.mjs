/** Validate the actual packaged artifact, not just the source staging directory. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceBuildInfo } from "./build-info.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const run = (command, args) => execFileSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

export function parseApkBadging(badging) {
  const value = (pattern, name) => {
    const result = badging.match(pattern);
    assert.ok(result, "Missing APK " + name);
    return result[1];
  };
  return {
    applicationId: value(/^package: name='([^']+)'/m, "package"),
    versionCode: value(/^package: .*\bversionCode='([^']+)'/m, "versionCode"),
    versionName: value(/^package: .*\bversionName='([^']+)'/m, "versionName"),
    minSdk: value(/^sdkVersion:'([^']+)'/m, "minSdk"),
    targetSdk: value(/^targetSdkVersion:'([^']+)'/m, "targetSdk"),
    label: value(/^application-label:'([^']+)'/m, "label"),
  };
}

export function verifyArtifactMetadata({ metadata, embedded, assets, expected, kind }) {
  assert.ok(kind === "apk" || kind === "aab");
  assert.equal(metadata.applicationId, expected.applicationId, "Artifact package mismatch");
  assert.equal(metadata.versionCode, String(expected.versionCode), "Artifact versionCode mismatch");
  assert.equal(metadata.versionName, expected.version, "Artifact versionName mismatch");
  assert.equal(metadata.minSdk, "24", "Artifact minSdk mismatch");
  assert.equal(metadata.targetSdk, "36", "Artifact targetSdk mismatch");
  if (kind === "apk") {
    assert.equal(metadata.label, expected.variant === "release" ? "별하루" : "별하루 비회원 STEP 9", "APK label mismatch");
  }
  assert.deepEqual(embedded, expected, "Embedded build-info does not match checked-out source/variant");
  const prefix = kind === "aab" ? "base/assets/public/" : "assets/public/";
  for (const file of ["app.js", "app.css", "index.html", "build-info.json"]) {
    assert.equal(assets.filter(name => name === prefix + file).length, 1, "Missing or duplicate asset: " + file);
  }
  assert.equal(
    assets.filter(name => name === prefix + "widget-cold-runtime.js").length,
    expected.variant === "debug" ? 1 : 0,
    "Experimental widget cold runtime must exist only in Debug",
  );
}

function verifyArtifact(kind, filename, tool) {
  assert.ok(kind === "apk" || kind === "aab", "Expected apk or aab");
  assert.ok(filename && tool, "Usage: check-android-artifact.mjs apk|aab ARTIFACT AAPT_OR_BUNDLETOOL");
  const expected = sourceBuildInfo(root, true);
  let metadata;
  if (kind === "apk") {
    metadata = parseApkBadging(run(tool, ["dump", "badging", filename]));
  } else {
    assert.equal(expected.variant, "release", "AAB must use release variant");
    run("java", ["-jar", tool, "validate", "--bundle=" + filename]);
    const dump = path => run("java", ["-jar", tool, "dump", "manifest", "--bundle=" + filename, "--xpath=" + path]).trim();
    metadata = {
      applicationId: dump("/manifest/@package"),
      versionCode: dump("/manifest/@android:versionCode"),
      versionName: dump("/manifest/@android:versionName"),
      minSdk: dump("/manifest/uses-sdk/@android:minSdkVersion"),
      targetSdk: dump("/manifest/uses-sdk/@android:targetSdkVersion"),
    };
  }
  const prefix = kind === "aab" ? "base/assets/public/" : "assets/public/";
  const assets = run("unzip", ["-Z1", filename]).trim().split(/\r?\n/);
  const embedded = JSON.parse(run("unzip", ["-p", filename, prefix + "build-info.json"]));
  verifyArtifactMetadata({ metadata, embedded, assets, expected, kind });
  assert.ok(run("unzip", ["-p", filename, prefix + "app.js"]).length > 30000, "Packaged JS is unexpectedly empty");
  console.log("PASS: " + kind + " metadata and embedded build-info match " + JSON.stringify(expected));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyArtifact(...process.argv.slice(2));
}
