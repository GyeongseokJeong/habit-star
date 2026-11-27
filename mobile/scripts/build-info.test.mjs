import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInfoFor, sourceBuildInfo } from "./build-info.mjs";
import { androidVariant, assertNewPlayVersion, patchGradleVersion, validateAndroidVersion } from "./android-release-version.mjs";

const version = { code: 7, name: "0.2.0" };
const sha = "a".repeat(40);

test("Android provenance records version, package and variant without affecting web version", () => {
  const result = buildInfoFor(version, sha, true, "release");
  assert.deepEqual(result, {
    schemaVersion: 2, app: "byeolharu", platform: "android-packaged-guest",
    version: "0.2.0", versionCode: 7, variant: "release",
    applicationId: "app.byeolharu.android", sourceSha: sha, cloudEnabled: true,
  });
  assert.equal(Object.isFrozen(result), true);
  const debug = buildInfoFor(version, sha, false, "debug");
  assert.equal(debug.applicationId, "io.github.gyeongseokjeong.byeolharu.packagedgueststep9");
  assert.equal(debug.version, result.version);
  assert.equal(debug.versionCode, result.versionCode);
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
