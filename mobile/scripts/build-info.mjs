import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function buildInfoFor(version, sourceSha) {
  assert.match(version, /^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i, "Invalid app version");
  assert.match(sourceSha, /^(?:[a-f0-9]{40}|unknown)$/i, "Invalid Git revision");
  return Object.freeze({
    schemaVersion: 1,
    app: "byeolharu",
    platform: "android-packaged-guest",
    version,
    sourceSha,
    cloudEnabled: false,
  });
}

export function sourceBuildInfo(root) {
  const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  let sha = "unknown";
  try {
    sha = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // A zip checkout can be built locally, but it must disclose unknown source.
  }
  return buildInfoFor(version, sha);
}
