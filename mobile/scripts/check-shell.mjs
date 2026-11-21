import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const html = readFileSync(resolve(root, "packaged-guest/index.html"), "utf8");
const config = readFileSync(resolve(root, "capacitor.config.ts"), "utf8");

for (const name of ["@capacitor/core", "@capacitor/android", "@capacitor/cli"]) {
  const version = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
  assert.equal(version, "8.6.2", `Capacitor packages must share exact tested versions: ${name}`);
}
assert.match(html, /<head>/i, "Packaged Android entry must have an HTML head");
assert.match(html, /lang="ko"/, "Packaged Android UI must declare Korean");
assert.match(html, /\.\/app\.js/, "The guest app must load its bundled React code");
assert.match(config, /BYEOLHARU_POC_PACKAGED_GUEST/, "Capacitor commands require explicit guest mode");
assert.match(config, /appId:\s*"io\.github\.gyeongseokjeong\.byeolharu\.packagedgueststep9"/);
assert.match(config, /appName:\s*"별하루 비회원 STEP 9"/);
assert.match(config, /webDir:\s*"www-packaged-guest"/);
assert.match(config, /SystemBars:\s*\{\s*insetsHandling:\s*"disable"/);
assert.doesNotMatch(config, /\bserver\s*:/, "Android must never load the live remote website");
assert.doesNotMatch(config, /webviewpoc|notificationpoc|reminderstep5|integrationstep8/, "Standalone PoC modes must remain retired");
assert.doesNotMatch(config, /serviceRole|service_role|SECRET_KEY/i, "Never embed Supabase secrets");
console.log("Single packaged guest Android shell structure OK (not an APK/device test)");
