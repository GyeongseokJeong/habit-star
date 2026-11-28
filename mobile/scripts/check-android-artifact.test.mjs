import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInfoFor } from "./build-info.mjs";
import { validateWidgetManifest } from "./check-guest-boot-manifest.mjs";
import { parseApkBadging, parseBundleDebuggable, parseApkWidgetCandidate, parseBundleWidgetCandidate, verifyArtifactMetadata, verifyPackagedAssetBytes } from "./check-android-artifact.mjs";

import { WIDGET_CANDIDATE_META } from "./widget-practice-mode.mjs";

function fixture(variant, kind, mode = variant === "debug" ? "debug" : "read-only") {
  const expected = buildInfoFor({ code: 7, name: "0.2.0" }, "a".repeat(40), true, variant, mode);
  const prefix = kind === "aab" ? "base/assets/public/" : "assets/public/";
  return {
    expected, embedded: { ...expected }, kind,
    metadata: { applicationId: expected.applicationId, versionCode: "7", versionName: "0.2.0", minSdk: "24", targetSdk: "36", debuggable: variant === "debug", widgetReleaseCandidate: mode === "release-candidate", label: variant === "debug" ? "별하루 비회원 STEP 9" : "별하루" },
    assets: ["app.js", "app.css", "index.html", "build-info.json", ...(mode !== "read-only" ? ["widget-cold-runtime.js"] : [])].map(name => prefix + name),
  };
}

test("APK and AAB metadata and packaged provenance validate for the matching variant", () => {
  for (const args of [fixture("debug", "apk"), fixture("release", "apk"), fixture("release", "aab"), fixture("release", "apk", "release-candidate")]) verifyArtifactMetadata(args);
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
    const check = () => verifyPackagedAssetBytes({ kind, widgetPractice: args.expected.widgetPractice, readEmbedded: path => files.get(path), readStaged: staged });
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
  const {widgetReleaseCandidate, ...expected} = fixture("release", "apk").metadata;
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


test("release widget candidate is non-debuggable, APK-only and tied to native marker and assets", () => {
  const candidate=fixture("release","apk","release-candidate");
  verifyArtifactMetadata(candidate);
  for (const [key,value] of [["debuggable",true],["widgetReleaseCandidate",false]]) {
    const bad=structuredClone(candidate);
    bad.metadata[key]=value;
    assert.throws(()=>verifyArtifactMetadata(bad),/mismatch/);
  }
  const normal=fixture("release","apk");
  normal.metadata.widgetReleaseCandidate=true;
  assert.throws(()=>verifyArtifactMetadata(normal),/candidate metadata mismatch/);
  assert.throws(()=>verifyArtifactMetadata(fixture("release","aab","release-candidate")),/never be an AAB/);
  const bad=structuredClone(candidate);
  bad.assets.pop();
  assert.throws(()=>verifyArtifactMetadata(bad),/Release candidate/);
  const files=new Map(candidate.assets.map(path=>[path,Buffer.from("expected:"+path.split("/").at(-1))]));
  verifyPackagedAssetBytes({kind:"apk",widgetPractice:"release-candidate",readEmbedded:path=>files.get(path),readStaged:file=>Buffer.from("expected:"+file)});
  files.delete("assets/public/widget-cold-runtime.js");
  assert.throws(()=>verifyPackagedAssetBytes({kind:"apk",widgetPractice:"release-candidate",readEmbedded:path=>files.get(path),readStaged:file=>Buffer.from("expected:"+file)}),/Missing or empty/);
});

test("compiled candidate metadata is a literal application boolean and cannot be duplicated", () => {
  const make=(value, indent="    ")=>indent+'E: meta-data (line=5)\n'+indent+'  A: android:name(0x01010003)="'+WIDGET_CANDIDATE_META+'" (Raw: "'+WIDGET_CANDIDATE_META+'")\n'+indent+'  A: android:value(0x01010024)=(type 0x12)'+value+'\n';
  const app="E: manifest (line=1)\n  E: application (line=2)\n";
  assert.equal(parseApkWidgetCandidate(app+make("0x0")),false);
  assert.equal(parseApkWidgetCandidate(app+make("0xffffffff")),true);
  assert.throws(()=>parseApkWidgetCandidate(app+make("0x1")+make("0x1")),/exactly one/);
  assert.throws(()=>parseApkWidgetCandidate(app+make("0x2")),/boolean/);
  assert.throws(()=>parseApkWidgetCandidate(app+'    E: activity (line=3)\n'+make("0x1","      ")),/application/);
  const tag=(v)=>'<meta-data android:value="'+v+'" android:name="'+WIDGET_CANDIDATE_META+'" />';
  assert.equal(parseBundleWidgetCandidate(WIDGET_CANDIDATE_META,tag("false")),false);
  assert.equal(parseBundleWidgetCandidate(WIDGET_CANDIDATE_META,tag("true")),true);
  assert.throws(()=>parseBundleWidgetCandidate("",tag("true")),/one AAB/);
  assert.throws(()=>parseBundleWidgetCandidate(WIDGET_CANDIDATE_META,tag("true")+tag("false")),/duplicate/);
  assert.throws(()=>parseBundleWidgetCandidate(WIDGET_CANDIDATE_META,tag("@bool/candidate")),/Invalid/);
});

test("CI candidate APK is isolated from default Release and the Play signing path", () => {
  const workflow=readFileSync(new URL("../../.github/workflows/android-poc.yml",import.meta.url),"utf8");
  const start=workflow.indexOf("- name: Build widget-enabled Release candidate APK");
  const upload=workflow.indexOf("- name: Upload widget-enabled Release candidate APK");
  const signing=workflow.indexOf("\n  sign-internal:");
  const ordinary=workflow.indexOf("name: byeolharu-android-release-unsigned");
  assert.ok(ordinary>0 && start>ordinary && upload>start && signing>upload);
  const candidate=workflow.slice(start,upload), artifact=workflow.slice(upload,signing), play=workflow.slice(signing);
  for(const step of [candidate,artifact]) assert.match(step,/if: github\.event_name == 'pull_request'/);
  assert.match(candidate,/BYEOLHARU_WIDGET_RELEASE_CANDIDATE: "1"/);
  assert.match(candidate,/assembleRelease/);
  assert.match(candidate,/check-android-artifact\.mjs apk/);
  assert.doesNotMatch(candidate,/bundleRelease|secrets\.|sign-aab/);
  assert.match(artifact,/name: byeolharu-widget-release-candidate-apk-test-signed/);
  assert.doesNotMatch(workflow.slice(0,start),/BYEOLHARU_WIDGET_RELEASE_CANDIDATE: "1"/);
  assert.match(play,/name: byeolharu-android-release-unsigned/);
  assert.match(play,/BYEOLHARU_WIDGET_RELEASE_CANDIDATE: "0"/);
  assert.doesNotMatch(play,/widget-release-candidate|BYEOLHARU_WIDGET_RELEASE_CANDIDATE: "1"/);
});
