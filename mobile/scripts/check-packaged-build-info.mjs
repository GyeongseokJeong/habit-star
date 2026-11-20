import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceBuildInfo } from "./build-info.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const out = resolve(root, "mobile/www-packaged-guest");
const path = resolve(out, "build-info.json");
assert.ok(existsSync(path), "Missing build-info.json");
assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), sourceBuildInfo(root));
for (const file of ["app.js", "app.css", "index.html"]) {
  assert.ok(existsSync(resolve(out, file)), "Missing Android bundled asset " + file);
}
if (process.env.CI === "true") {
  assert.notEqual(sourceBuildInfo(root).sourceSha, "unknown", "CI must stamp the checked-out Git SHA");
}
console.log("PASS: packaged UI and build-info.json match checked-out source");
