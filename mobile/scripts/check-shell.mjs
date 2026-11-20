import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const html = readFileSync(resolve(root, "www/index.html"), "utf8");
const config = readFileSync(resolve(root, "capacitor.config.ts"), "utf8");

for (const name of ["@capacitor/core", "@capacitor/android", "@capacitor/cli"]) {
  const version = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
  assert.equal(version, "8.6.2", `Capacitor packages must share exact tested versions: ${name}`);
}
assert.match(html, /<head>/i, "Capacitor bridge requires an HTML head");
assert.match(html, /lang="ko"/, "The fallback must remain usable in Korean");
assert.match(config, /webDir:\s*"www"/);
assert.match(config, /BYEOLHARU_POC_REMOTE_DEBUG/, "Remote loading must require explicit opt-in");
assert.match(config, /const productionOrigin = "https:\/\/habit-star-fawn\.vercel\.app"/, "Only the explicitly approved HTTPS origin is allowed");
assert.match(config, /io\.github\.gyeongseokjeong\.byeolharu\.webviewpoc/, "Remote debug requires its own Android app ID");
assert.doesNotMatch(config, /serviceRole|service_role|SECRET_KEY/i, "Never embed Supabase secrets");
console.log("Android PoC shell structure OK (not an APK/device test)");
