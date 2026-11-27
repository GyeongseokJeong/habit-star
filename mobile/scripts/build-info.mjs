import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { ANDROID_APPLICATION_IDS, androidVariant, readAndroidVersion, validateAndroidVersion } from "./android-release-version.mjs";

export function buildInfoFor(version, sourceSha, cloudEnabled, variant) {
  const { code, name } = validateAndroidVersion(version);
  assert.match(sourceSha, /^(?:[a-f0-9]{40}|unknown)$/i, "Invalid Git revision");
  assert.ok(Object.hasOwn(ANDROID_APPLICATION_IDS, variant), "Invalid Android variant");
  assert.equal(typeof cloudEnabled, "boolean", "Invalid cloud capability");
  return Object.freeze({
    schemaVersion: 2,
    app: "byeolharu",
    platform: "android-packaged-guest",
    version: name,
    versionCode: code,
    variant,
    applicationId: ANDROID_APPLICATION_IDS[variant],
    sourceSha,
    cloudEnabled,
  });
}

export function sourceBuildInfo(root, cloudEnabled = false, variant = androidVariant()) {
  const version = readAndroidVersion(resolve(root, "mobile"));
  let sha = "unknown";
  try {
    sha = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // A debug zip checkout can be built locally, but must disclose unknown source.
  }
  if (variant === "release" || process.env.CI === "true") {
    assert.match(sha, /^[a-f0-9]{40}$/i, "Release/CI requires a checked-out Git SHA");
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    assert.equal(sha, process.env.GITHUB_SHA, "Git SHA must match the GitHub Actions checkout");
  }
  return buildInfoFor(version, sha, cloudEnabled, variant);
}
