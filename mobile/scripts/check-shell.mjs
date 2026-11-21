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
  assert.equal(version, "8.6.2", "Capacitor packages must share tested versions: " + name);
}
assert.match(html, /<head>/i, "Packaged shell requires a HTML head");
assert.match(html, /lang="ko"/, "Packaged shell must remain usable in Korean");
assert.match(config, /webDir:\s*"www-packaged-guest"/, "Must use bundled React assets");
assert.match(config, /appId:\s*"io\.github\.gyeongseokjeong\.byeolharu\.packagedgueststep9"/, "Must preserve app ID and local data storage");
assert.match(config, /plugins:\s*\{\s*SystemBars:\s*\{\s*insetsHandling:\s*"disable"/, "Native safe area must not be applied twice");
assert.doesNotMatch(config, /server:\s*\{\s*url\s*:/, "Android must not load remote WebView");
assert.doesNotMatch(config, /serviceRole|service_role|SECRET_KEY/i, "Never embed Supabase secrets");
console.log("Packaged Android guest configuration OK (not a device test)");
