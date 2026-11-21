import test from "node:test";
import assert from "node:assert/strict";
import { buildInfoFor } from "./build-info.mjs";

test("Android provenance is a deterministic public, guest-only manifest", () => {
  const sha = "a".repeat(40);
  const result = buildInfoFor("1.0.0", sha);
  assert.deepEqual(result, {
    schemaVersion: 1,
    app: "byeolharu",
    platform: "android-packaged-guest",
    version: "1.0.0",
    sourceSha: sha,
    cloudEnabled: false,
  });
  assert.equal(Object.isFrozen(result), true);
});
test("cloud-enabled Android build flags the member capability without embedding secrets", () => {
  const info = buildInfoFor("1.0.0", "a".repeat(40), true);
  assert.equal(info.cloudEnabled, true);
  assert.equal(Object.hasOwn(info, "publishableKey"), false);
});
test("invalid release version or source SHA cannot be stamped", () => {
  assert.throws(() => buildInfoFor("latest", "a".repeat(40)));
  assert.throws(() => buildInfoFor("1.0.0", "123"));
  assert.equal(buildInfoFor("1.0.0", "unknown").sourceSha, "unknown");
});
