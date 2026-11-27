import test from "node:test";
import assert from "node:assert/strict";
import { inspectReleaseSources, loadReleaseSources } from "./check-android-release-readiness.mjs";

const sources = loadReleaseSources();

test("generated Android release pipeline is configured but never statically approved for publishing", () => {
  const report = inspectReleaseSources(sources);
  assert.equal(report.sourceReady, true, JSON.stringify(report.blockers));
  assert.equal(report.ready, false);
  assert.deepEqual(report.version, JSON.parse(sources.versionJson));
  assert.ok(report.manualGates.some(x => x.includes("Play Console")));
  assert.ok(report.manualGates.some(x => x.includes("transitive npm")));
});

test("missing configuration, final validation or protected signing fail closed", () => {
  for (const [field, value, id] of [
    ["versionJson", '{"code":0,"name":"latest"}', "INVALID_ANDROID_VERSION"],
    ["config", sources.config.replace('appId: "app.byeolharu.android"', 'appId: "invalid"'), "RELEASE_APP_ID_OR_LABEL"],
    ["patcher", '/* patchGradleVersion(gradle, readAndroidVersion(mobileRoot)) */', "UNVERSIONED_NATIVE_CONFIGURATION"],
    ["workflow", sources.workflow.replace("./gradlew bundleRelease --no-daemon", "# ./gradlew bundleRelease --no-daemon"), "NO_RELEASE_BUNDLE_PIPELINE"],
    ["workflow", sources.workflow.replace("node mobile/scripts/check-android-artifact.mjs aab ", "# node mobile/scripts/check-android-artifact.mjs aab "), "NO_FINAL_ARTIFACT_VERIFICATION"],
    ["workflow", sources.workflow.replace("environment: play-internal", "# environment: play-internal"), "NO_PROTECTED_SIGNING_PIPELINE"],
  ]) {
    const report = inspectReleaseSources({ ...sources, [field]: value });
    assert.equal(report.sourceReady, false);
    assert.equal(report.ready, false);
    assert.ok(report.blockers.some(x => x.id === id), id);
  }
});

test("readiness is deterministic and never outputs signing secrets", () => {
  const report = inspectReleaseSources(sources);
  assert.ok(report.manualGates.length >= 8);
  assert.equal(JSON.stringify(inspectReleaseSources(sources)), JSON.stringify(report));
  assert.doesNotMatch(JSON.stringify(report), /-----BEGIN PRIVATE KEY-----|PASSWORD=/);
  assert.throws(() => inspectReleaseSources({ ...sources, config: null }));
});
