/**
 * Patch Capacitor's generated debug MainActivity after `cap add android`.
 * Keeping the native template separate avoids committing disposable Gradle
 * output during PoC; a future release must commit the native Android project.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(mobileRoot, "android/app/src/main/java");
const template = readFileSync(resolve(mobileRoot, "native/MainActivity.java.template"), "utf8");

function findActivityFiles(folder) {
  const found = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...findActivityFiles(file));
    else if (entry.isFile() && entry.name === "MainActivity.java") found.push(file);
  }
  return found;
}

const files = findActivityFiles(sourceRoot);
assert.equal(files.length, 1, "Expected exactly one generated MainActivity.java");
const path = files[0];
const current = readFileSync(path, "utf8");
const match = current.match(/^package ([a-zA-Z_][a-zA-Z_0-9]*(?:\.[a-zA-Z_][a-zA-Z_0-9]*)*);/m);
assert.ok(match, "Could not read the generated Android package name");
assert.ok(current.includes("extends BridgeActivity"), "Unexpected activity template; refusing patch");
const targetPackage = match[1];
assert.ok(
  targetPackage.startsWith("io.github.gyeongseokjeong.byeolharu."),
  "Refusing to patch an unrelated Android package",
);
assert.ok(template.includes("__PACKAGE__"), "Missing package placeholder in native template");
const patched = template.replace("__PACKAGE__", targetPackage);
assert.ok(!patched.includes("__PACKAGE__"));
if (current !== patched) writeFileSync(path, patched);
console.log(`Android native PoC activity patched for ${targetPackage}`);
