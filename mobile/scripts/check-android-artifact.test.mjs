import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInfoFor } from "./build-info.mjs";
import { validateWidgetManifest } from "./check-guest-boot-manifest.mjs";
import { parseApkBadging, parseBundleDebuggable, parseApkWidgetPractice, parseBundleWidgetPractice, verifyArtifactMetadata, verifyPackagedAssetBytes } from "./check-android-artifact.mjs";

import { WIDGET_RELEASE_META, WIDGET_LEGACY_CANDIDATE_META } from "./widget-practice-mode.mjs";

function fixture(variant, kind, mode = variant === "debug" ? "debug" : "release-enabled") {
  const expected = buildInfoFor({ code: 7, name: "0.2.0" }, "a".repeat(40), true, variant, mode);
  const prefix = kind === "aab" ? "base/assets/public/" : "assets/public/";
  return {
    expected, embedded: { ...expected }, kind,
    metadata: { applicationId: expected.applicationId, versionCode: "7", versionName: "0.2.0", minSdk: "24", targetSdk: "36", debuggable: variant === "debug", widgetReleaseDirectPractice: mode === "release-enabled", label: variant === "debug" ? "별하루 비회원 STEP 9" : "별하루" },
    assets: ["app.js", "app.css", "index.html", "build-info.json", "widget-cold-runtime.js"].map(name => prefix + name),
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

test("missing or duplicate runtime and other required assets fail closed", () => {
  const release = fixture("release", "aab");
  release.assets.push("base/assets/public/widget-cold-runtime.js");
  assert.throws(() => verifyArtifactMetadata(release), /Missing or duplicate/);
  const debug = fixture("debug", "apk");
  debug.assets.pop();
  assert.throws(() => verifyArtifactMetadata(debug), /Missing or duplicate/);
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
  const {widgetReleaseDirectPractice, ...expected} = fixture("release", "apk").metadata;
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


test("normal Release APK and AAB require enabled practice, correct provenance, and non-debuggable build", () => {
  for (const kind of ["apk", "aab"]) {
    const release=fixture("release",kind);
    verifyArtifactMetadata(release);
    for (const [key,value] of [["debuggable",true],["widgetReleaseDirectPractice",false],["widgetReleaseDirectPractice",undefined]]) {
      const bad=structuredClone(release);
      bad.metadata[key]=value;
      assert.throws(()=>verifyArtifactMetadata(bad),/mismatch/);
    }
    for (const obsolete of ["read-only", "release-candidate"]) {
      const bad=structuredClone(release);
      bad.expected.widgetPractice=obsolete;
      assert.throws(()=>verifyArtifactMetadata(bad),/Invalid expected widget practice mode/);
      const stale=structuredClone(release);
      stale.embedded.widgetPractice=obsolete;
      stale.embedded.schemaVersion=3;
      assert.throws(()=>verifyArtifactMetadata(stale),/Embedded build-info/);
    }
    const bad=structuredClone(release);
    bad.assets.pop();
    assert.throws(()=>verifyArtifactMetadata(bad),/Missing or duplicate.*widget-cold-runtime/);
  }
  const debug=fixture("debug","apk");
  debug.metadata.widgetReleaseDirectPractice=true;
  assert.throws(()=>verifyArtifactMetadata(debug),/practice metadata mismatch/);
  assert.throws(()=>verifyArtifactMetadata(fixture("debug","aab")),/AAB must use release variant/);
});

test("compiled practice metadata is a literal application boolean and cannot be duplicated", () => {
  const make=(value, indent="    ")=>indent+'E: meta-data (line=5)\n'+indent+'  A: android:name(0x01010003)="'+WIDGET_RELEASE_META+'" (Raw: "'+WIDGET_RELEASE_META+'")\n'+indent+'  A: android:value(0x01010024)=(type 0x12)'+value+'\n';
  const app="E: manifest (line=1)\n  E: application (line=2)\n";
  assert.equal(parseApkWidgetPractice(app+make("0x0")),false);
  assert.equal(parseApkWidgetPractice(app+make("0xffffffff")),true);
  assert.throws(()=>parseApkWidgetPractice(app+make("0xffffffff").replaceAll(WIDGET_RELEASE_META,WIDGET_LEGACY_CANDIDATE_META)),/Obsolete/);
  assert.throws(()=>parseApkWidgetPractice(app),/exactly one/);
  assert.throws(()=>parseApkWidgetPractice(app+make("0x1")+make("0x1")),/exactly one/);
  assert.throws(()=>parseApkWidgetPractice(app+make("0x2")),/boolean/);
  assert.throws(()=>parseApkWidgetPractice(app+'    E: activity (line=3)\n'+make("0x1","      ")),/application/);
  const tag=(v)=>'<meta-data android:value="'+v+'" android:name="'+WIDGET_RELEASE_META+'" />';
  assert.equal(parseBundleWidgetPractice(WIDGET_RELEASE_META,tag("false")),false);
  assert.equal(parseBundleWidgetPractice(WIDGET_RELEASE_META,tag("true")),true);
  assert.throws(()=>parseBundleWidgetPractice(WIDGET_LEGACY_CANDIDATE_META,tag("true").replace(WIDGET_RELEASE_META,WIDGET_LEGACY_CANDIDATE_META)),/Obsolete/);
  assert.throws(()=>parseBundleWidgetPractice("",tag("true")),/one AAB/);
  assert.throws(()=>parseBundleWidgetPractice(WIDGET_RELEASE_META,tag("true")+tag("false")),/duplicate/);
  assert.throws(()=>parseBundleWidgetPractice(WIDGET_RELEASE_META,tag("@bool/candidate")),/Invalid/);
});

test("normal Release artifacts are the only Play signing inputs; old candidate path is retired", () => {
  const workflow=readFileSync(new URL("../../.github/workflows/android-poc.yml",import.meta.url),"utf8");
  const signing=workflow.indexOf("\n  sign-internal:");
  assert.ok(signing>0);
  const ordinary=workflow.slice(0,signing), play=workflow.slice(signing);
  assert.doesNotMatch(workflow,/widget-release-candidate|BYEOLHARU_WIDGET_RELEASE_CANDIDATE/);
  assert.match(ordinary,/BYEOLHARU_ANDROID_RELEASE: "1"/);
  assert.match(ordinary,/bundleRelease/);
  assert.match(ordinary,/check-android-artifact\.mjs aab/);
  assert.match(ordinary,/assembleRelease/);
  assert.match(ordinary,/name: byeolharu-android-release-unsigned/);
  assert.match(play,/if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs.sign_internal/);
  assert.match(play,/environment: play-internal/);
  assert.match(play,/name: byeolharu-android-release-unsigned/);
  assert.match(play,/assertNewPlayVersion/);
  assert.match(play,/unzip -p unsigned\/app-release.aab base\/assets\/public\/build-info.json \| cmp unsigned\/build-info.json -/);
  assert.match(play,/unzip -p byeolharu-internal.aab base\/assets\/public\/build-info.json \| cmp unsigned\/build-info.json -/);
  assert.match(play,/sourceBuildInfo\(process.cwd\(\),true,"release"\)/);
});
