import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ANDROID_APPLICATION_IDS = Object.freeze({
  debug: "io.github.gyeongseokjeong.byeolharu.packagedgueststep9",
  release: "app.byeolharu.android",
});

export function validateAndroidVersion(value) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected Android version object");
  assert.ok(Number.isSafeInteger(value.code) && value.code > 0 && value.code <= 2100000000, "Invalid Android versionCode");
  assert.ok(typeof value.name === "string" && /^\d+\.\d+\.\d+$/.test(value.name), "Expected a numeric Android versionName");
  return Object.freeze({ code: value.code, name: value.name });
}

export function readAndroidVersion(mobileRoot) {
  return validateAndroidVersion(JSON.parse(readFileSync(resolve(mobileRoot, "release-version.json"), "utf8")));
}

export function androidVariant(value = process.env.BYEOLHARU_ANDROID_RELEASE) {
  assert.ok(value === undefined || value === "" || value === "0" || value === "1", "Invalid BYEOLHARU_ANDROID_RELEASE");
  return value === "1" ? "release" : "debug";
}

export function patchGradleVersion(gradle, version) {
  const { code, name } = validateAndroidVersion(version);
  const codeLine = /^(\s*versionCode )\d+(\s*)$/gm;
  const nameLine = /^(\s*versionName )"[^"]+"(\s*)$/gm;
  assert.equal([...gradle.matchAll(codeLine)].length, 1, "Expected one default versionCode");
  assert.equal([...gradle.matchAll(nameLine)].length, 1, "Expected one default versionName");
  return gradle.replace(codeLine, (_, prefix, suffix) => prefix + code + suffix)
    .replace(nameLine, (_, prefix, suffix) => prefix + '"' + name + '"' + suffix);
}

export function assertNewPlayVersion(version, highestUsed) {
  const { code } = validateAndroidVersion(version);
  assert.ok(typeof highestUsed === "string" && /^(?:0|[1-9]\d*)$/.test(highestUsed),
    "Confirm highest previously used Play versionCode (0 only for a confirmed first upload)");
  const highest = Number(highestUsed);
  assert.ok(Number.isSafeInteger(highest) && highest <= 2100000000, "Invalid highest Play versionCode");
  assert.ok(code > highest, "Android versionCode must exceed the highest previously used Play versionCode");
}
