import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInfoFor, sourceBuildInfo } from "./build-info.mjs";
import { widgetPracticeMode, patchWidgetPracticeManifest, WIDGET_RELEASE_META, WIDGET_LEGACY_CANDIDATE_META } from "./widget-practice-mode.mjs";
import { androidVariant, assertNewPlayVersion, patchGradleVersion, validateAndroidVersion } from "./android-release-version.mjs";

const version = { code: 7, name: "0.2.0" };
const sha = "a".repeat(40);

test("Android provenance records version, package and variant without affecting web version", () => {
  const result = buildInfoFor(version, sha, true, "release");
  assert.deepEqual(result, {
    schemaVersion: 4, app: "byeolharu", platform: "android-packaged-guest",
    version: "0.2.0", versionCode: 7, variant: "release",
    applicationId: "app.byeolharu.android", sourceSha: sha, cloudEnabled: true, widgetPractice: "release-enabled",
  });
  assert.equal(Object.isFrozen(result), true);
  const debug = buildInfoFor(version, sha, false, "debug");
  assert.equal(debug.applicationId, "io.github.gyeongseokjeong.byeolharu.packagedgueststep9");
  assert.equal(debug.version, result.version);
  assert.equal(debug.versionCode, result.versionCode);
  assert.equal(debug.widgetPractice, "debug");
  assert.throws(() => buildInfoFor(version, sha, true, "release", "release-candidate"), /widget mode/);
  assert.throws(() => buildInfoFor(version, sha, true, "release", "read-only"), /widget mode/);
  assert.throws(() => buildInfoFor(version, sha, true, "debug", "release-candidate"), /widget mode/);
  assert.equal(Object.hasOwn(result, "publishableKey"), false);
});

test("invalid version, revision, variant or environment cannot be stamped", () => {
  for (const code of [0, -1, 1.5, "1", 2100000001, null]) assert.throws(() => validateAndroidVersion({ code, name: "0.1.0" }));
  for (const name of [null, 1, "1.0", "latest", "1.0.0-beta", "1.0.0\n"]) assert.throws(() => validateAndroidVersion({ code: 1, name }));
  assert.equal(validateAndroidVersion({ code: 2100000000, name: "1.2.3" }).code, 2100000000);
  assert.throws(() => buildInfoFor(version, "123", true, "release"));
  assert.throws(() => buildInfoFor(version, sha, true, "production"));
  assert.equal(androidVariant("0"), "debug");
  assert.equal(androidVariant("1"), "release");
  assert.throws(() => androidVariant("true"));
});

test("both variants share the same Android version patch; ambiguous Gradle input fails closed", () => {
  const gradle = 'defaultConfig {\n  versionCode 1\n  versionName "1.0"\n}\n';
  const patched = patchGradleVersion(gradle, version);
  assert.match(patched, /versionCode 7/);
  assert.match(patched, /versionName "0\.2\.0"/);
  assert.equal(patchGradleVersion(patched, version), patched);
  assert.throws(() => patchGradleVersion(gradle + "versionCode 8\n", version));
  assert.throws(() => patchGradleVersion("versionCode 1\n", version));
});

test("Android source reads mobile release-version.json rather than root package version", () => {
  const root = mkdtempSync(join(tmpdir(), "byeolharu-version-"));
  try {
    mkdirSync(join(root, "mobile"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    writeFileSync(join(root, "mobile/release-version.json"), JSON.stringify(version));
    // This fixture has no Git checkout, so local debug must disclose unknown.
    const saved = { CI: process.env.CI, GITHUB_ACTIONS: process.env.GITHUB_ACTIONS };
    try {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      assert.equal(sourceBuildInfo(root, true, "debug").version, version.name);
      assert.equal(sourceBuildInfo(root, true, "debug").sourceSha, "unknown");
      assert.throws(() => sourceBuildInfo(root, true, "release"), /Git SHA/);
      process.env.CI = "true";
      assert.throws(() => sourceBuildInfo(root, true, "debug"), /Git SHA/);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Play signing requires a confirmed highest used code and a strictly newer release code", () => {
  assert.doesNotThrow(() => assertNewPlayVersion(version, "0"));
  assert.doesNotThrow(() => assertNewPlayVersion(version, "6"));
  for (const highest of ["", "7", "8", "-1", "1.5", "unknown", "2100000001", undefined]) {
    assert.throws(() => assertNewPlayVersion(version, highest));
  }
});

test("release stamps a clean committed source and rejects dirty or mismatched CI revisions", () => {
  const root = mkdtempSync(join(tmpdir(), "byeolharu-git-version-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const saved = { CI: process.env.CI, GITHUB_ACTIONS: process.env.GITHUB_ACTIONS, GITHUB_SHA: process.env.GITHUB_SHA };
  try {
    mkdirSync(join(root, "mobile"));
    writeFileSync(join(root, "mobile/release-version.json"), JSON.stringify(version));
    git("init", "-q");
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture");
    const revision = git("rev-parse", "HEAD");
    process.env.CI = "true";
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_SHA = revision;
    assert.equal(sourceBuildInfo(root, true, "release").sourceSha, revision);
    process.env.GITHUB_SHA = "b".repeat(40);
    assert.throws(() => sourceBuildInfo(root, true, "release"), /GitHub Actions checkout/);
    process.env.GITHUB_SHA = revision;
    writeFileSync(join(root, "mobile/release-version.json"), JSON.stringify({ code: 8, name: "0.2.1" }));
    assert.throws(() => sourceBuildInfo(root, true, "release"), /clean tracked Git checkout/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
});



test("normal variants enable practice and reject retired candidate switches", () => {
  assert.equal(widgetPracticeMode("debug"), "debug");
  assert.equal(widgetPracticeMode("release"), "release-enabled");
  for (const variant of ["debug", "release"]) {
    for (const value of ["", "0", "1", "true"]) assert.throws(() => widgetPracticeMode(variant, value), /Obsolete/);
  }
});

test("release practice manifest marker is application-only, idempotent, and migrates legacy generated trees", () => {
  const base = '<manifest><application android:name=".Example"><activity /></application></manifest>';
  const debug = patchWidgetPracticeManifest(base, "debug");
  const release = patchWidgetPracticeManifest(base, "release-enabled");
  assert.ok(debug.includes('android:name="' + WIDGET_RELEASE_META + '" android:value="false"'));
  assert.ok(release.includes('android:name="' + WIDGET_RELEASE_META + '" android:value="true"'));
  assert.equal(patchWidgetPracticeManifest(release, "release-enabled"), release);
  assert.equal(patchWidgetPracticeManifest(release, "debug"), debug);
  assert.equal(patchWidgetPracticeManifest(debug, "release-enabled"), release);
  for (const previous of [debug, release]) {
    const legacy = previous.replace(WIDGET_RELEASE_META, WIDGET_LEGACY_CANDIDATE_META);
    assert.equal(patchWidgetPracticeManifest(legacy, "release-enabled"), release);
    assert.equal(patchWidgetPracticeManifest(legacy, "debug"), debug);
  }
  const tag = '<meta-data android:name="' + WIDGET_RELEASE_META + '" android:value="true" />';
  assert.throws(() => patchWidgetPracticeManifest(release.replace("<activity />", tag), "debug"), /Duplicate/);
  assert.throws(() => patchWidgetPracticeManifest(release.replace("<activity />", tag.replace(WIDGET_RELEASE_META, WIDGET_LEGACY_CANDIDATE_META)), "release-enabled"), /Duplicate/);
  assert.throws(() => patchWidgetPracticeManifest(base.replace("<activity />", '<activity>' + tag + '</activity>'), "release-enabled"), /belong to application/);
  assert.throws(() => patchWidgetPracticeManifest(base, "read-only"), /Invalid widget mode/);
});
