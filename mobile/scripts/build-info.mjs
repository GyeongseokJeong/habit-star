import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { widgetPracticeMode } from "./widget-practice-mode.mjs";
import { ANDROID_APPLICATION_IDS, androidVariant, readAndroidVersion, validateAndroidVersion } from "./android-release-version.mjs";

export function buildInfoFor(version, sourceSha, cloudEnabled, variant, mode = widgetPracticeMode(variant, "0")) {
  const { code, name } = validateAndroidVersion(version);
  assert.match(sourceSha, /^(?:[a-f0-9]{40}|unknown)$/i, "Invalid Git revision");
  assert.ok(Object.hasOwn(ANDROID_APPLICATION_IDS, variant), "Invalid Android variant");
  assert.equal(typeof cloudEnabled, "boolean", "Invalid cloud capability");
  assert.ok(variant === "debug" ? mode === "debug" : ["read-only", "release-candidate"].includes(mode), "Invalid widget mode for variant");
  return Object.freeze({
    schemaVersion: 3,
    app: "byeolharu",
    platform: "android-packaged-guest",
    version: name,
    versionCode: code,
    variant,
    applicationId: ANDROID_APPLICATION_IDS[variant],
    sourceSha,
    cloudEnabled,
    widgetPractice: mode,
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
  if (variant === "release") {
    const changes = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    });
    assert.equal(changes, "", "Release requires a clean tracked Git checkout");
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    assert.equal(sha, process.env.GITHUB_SHA, "Git SHA must match the GitHub Actions checkout");
  }
  return buildInfoFor(version, sha, cloudEnabled, variant, widgetPracticeMode(variant));
}
