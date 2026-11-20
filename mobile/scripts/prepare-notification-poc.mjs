import assert from "node:assert/strict";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

assert.equal(process.env.BYEOLHARU_POC_NOTIFICATIONS, "1", "Refusing to overwrite the default placeholder outside notification mode");
assert.notEqual(process.env.BYEOLHARU_POC_REMOTE_DEBUG, "1", "Remote website is forbidden for the native notification PoC");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(resolve(root, "www"), { recursive: true });
const step5 = process.env.BYEOLHARU_POC_REMINDER_STEP5 === "1";
const step8 = process.env.BYEOLHARU_POC_INTEGRATION_STEP8 === "1";
assert.ok(!(step5 && step8), "STEP 5 and STEP 8 must be separate packages");
copyFileSync(resolve(root, step8 ? "notifications/reminder-step8.html" : step5 ? "notifications/reminder-step5.html" : "notifications/index.html"), resolve(root, "www/index.html"));
await build({
  entryPoints: [resolve(root, step8 ? "notifications/reminder-step8-main.js" : step5 ? "notifications/reminder-step5-main.js" : "notifications/main.js")],
  outfile: resolve(root, step8 ? "www/reminder-step8.js" : step5 ? "www/reminder-step5.js" : "www/notification-poc.js"),
  bundle: true,
  minify: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  logLevel: "warning",
});
console.log("Isolated Android notification PoC assets ready.");
