import assert from "node:assert/strict";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

assert.equal(process.env.BYEOLHARU_POC_NOTIFICATIONS, "1", "Refusing to overwrite the default placeholder outside notification mode");
assert.notEqual(process.env.BYEOLHARU_POC_REMOTE_DEBUG, "1", "Remote website is forbidden for the native notification PoC");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(resolve(root, "www"), { recursive: true });
copyFileSync(resolve(root, "notifications/index.html"), resolve(root, "www/index.html"));
await build({
  entryPoints: [resolve(root, "notifications/main.js")],
  outfile: resolve(root, "www/notification-poc.js"),
  bundle: true,
  minify: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  logLevel: "warning",
});
console.log("Isolated Android notification PoC assets ready.");
