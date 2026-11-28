/** Validate the actual packaged artifact, not just the source staging directory. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sourceBuildInfo } from "./build-info.mjs";
import { WIDGET_RELEASE_META, WIDGET_LEGACY_CANDIDATE_META } from "./widget-practice-mode.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const run = (command, args) => execFileSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const readArchive = (filename, path) => execFileSync("unzip", ["-p", filename, path], { maxBuffer: 16 * 1024 * 1024 });
const requiredAssets = ["app.js", "app.css", "index.html", "build-info.json", "widget-cold-runtime.js"];
const assetPrefix = kind => kind === "aab" ? "base/assets/public/" : "assets/public/";

export function parseApkBadging(badging) {
  const value = (pattern, name) => {
    const result = badging.match(pattern);
    assert.ok(result, "Missing APK " + name);
    return result[1];
  };
  return {
    applicationId: value(/^package: name='([^']+)'/m, "package"),
    versionCode: value(/^package: .*\bversionCode='([^']+)'/m, "versionCode"),
    versionName: value(/^package: .*\bversionName='([^']+)'/m, "versionName"),
    minSdk: value(/^sdkVersion:'([^']+)'/m, "minSdk"),
    targetSdk: value(/^targetSdkVersion:'([^']+)'/m, "targetSdk"),
    label: value(/^application-label:'([^']+)'/m, "label"),
    // aapt emits this standalone marker only when the actual application
    // manifest resolves android:debuggable to true. The widget provider
    // uses this flag only for Debug; the Release uses separate metadata.
    debuggable: /^application-debuggable\r?$/m.test(badging),
  };
}

// bundletool 1.18.3 dump manifest --xpath returns attribute values, one per
// line, or an empty string when absent. Android's default is non-debuggable.
export function parseBundleDebuggable(value) {
  assert.ok(["", "false", "true"].includes(value), "Unexpected AAB debuggable attribute");
  return value === "true";
}

// Validate the compiled application-level metadata. Never trust only the
// JS build-info stamp. aapt reports each element with its own attributes.
export function parseApkWidgetPractice(tree) {
  assert.ok(!tree.includes(WIDGET_LEGACY_CANDIDATE_META), "Obsolete APK widget candidate marker");
  const sections = tree.split(/\n(?=\s*E: )/);
  const stack = [], values = [];
  for (const section of sections) {
    const node = section.match(/^( *)(?:E: )([\w-]+)(?:\s|$)/);
    if (!node) continue;
    const depth = node[1].length;
    while (stack.length && stack.at(-1).depth >= depth) stack.pop();
    if (node[2] === "meta-data" && [...section.matchAll(/^\s*A: android:name(?:\(0x[0-9a-f]+\))?="([^"\n]+)"/gmi)].some(attribute => attribute[1] === WIDGET_RELEASE_META)) {
      assert.equal(stack.at(-1)?.name, "application", "Widget practice metadata must belong to application");
      const attributes = [...section.matchAll(/^\s*A: android:value(?:\(0x[0-9a-f]+\))?=(.*)$/gmi)];
      assert.equal(attributes.length, 1, "Invalid APK widget practice metadata");
      const value = attributes[0][1].trim().match(/^\(type 0x12\)(0x[0-9a-f]+)$/i);
      assert.ok(value, "Invalid APK widget practice metadata");
      const n=Number(value[1]);
      assert.ok([0,1,0xffffffff].includes(n), "Invalid APK widget practice boolean");
      values.push(n!==0);
    }
    stack.push({depth,name:node[2]});
  }
  assert.equal(values.length,1,"Expected exactly one APK widget practice metadata marker");
  return values[0];
}

// Use bundletool's simple XPath for application-only names and the manifest
// XML to bind the exact named marker to a literal boolean (no resource refs).
export function parseBundleWidgetPractice(names, xml) {
  assert.ok(!xml.includes(WIDGET_LEGACY_CANDIDATE_META), "Obsolete AAB widget candidate marker");
  assert.equal(names.split(/\r?\n/).filter(name=>name.trim()===WIDGET_RELEASE_META).length,1,
    "Expected exactly one AAB application widget practice marker");
  const tags=[...xml.matchAll(/<meta-data\b[^>]*>/g)].map(m=>m[0])
    .filter(tag=>tag.includes('android:name="' + WIDGET_RELEASE_META + '"'));
  assert.equal(tags.length,1,"Missing or duplicate AAB widget practice metadata");
  const value=tags[0].match(/\bandroid:value="(true|false)"/);
  assert.ok(value,"Invalid AAB widget practice metadata");
  return value[1]==="true";
}

export function verifyArtifactMetadata({ metadata, embedded, assets, expected, kind }) {
  assert.ok(kind === "apk" || kind === "aab");
  assert.ok(["debug", "release"].includes(expected.variant), "Invalid variant");
  assert.equal(expected.widgetPractice, expected.variant === "release" ? "release-enabled" : "debug", "Invalid expected widget practice mode");
  assert.equal(metadata.applicationId, expected.applicationId, "Artifact package mismatch");
  assert.equal(metadata.versionCode, String(expected.versionCode), "Artifact versionCode mismatch");
  assert.equal(metadata.versionName, expected.version, "Artifact versionName mismatch");
  assert.equal(metadata.minSdk, "24", "Artifact minSdk mismatch");
  assert.equal(metadata.targetSdk, "36", "Artifact targetSdk mismatch");
  assert.equal(metadata.debuggable, expected.variant === "debug", "Artifact debuggable mismatch");
  assert.ok(kind !== "aab" || expected.variant === "release", "AAB must use release variant");
  assert.equal(metadata.widgetReleaseDirectPractice, expected.widgetPractice === "release-enabled", "Artifact widget practice metadata mismatch");
  if (kind === "apk") {
    assert.equal(metadata.label, expected.variant === "release" ? "별하루" : "별하루 비회원 STEP 9", "APK label mismatch");
  }
  assert.deepEqual(embedded, expected, "Embedded build-info does not match checked-out source/variant");
  const prefix = assetPrefix(kind);
  for (const file of requiredAssets) {
    assert.equal(assets.filter(name => name === prefix + file).length, 1, "Missing or duplicate asset: " + file);
  }

}

// Compare the archive bytes to the verified same-job staging inputs, not
// merely the self-reported build-info stamp. Do not print bundle contents.
export function verifyPackagedAssetBytes({ kind, widgetPractice, readEmbedded, readStaged }) {
  assert.ok(["debug", "release-enabled"].includes(widgetPractice), "Invalid expected widget practice mode");
  for (const file of requiredAssets) {
    const embedded = readEmbedded(assetPrefix(kind) + file);
    const staged = readStaged(file);
    assert.ok(Buffer.isBuffer(embedded) && Buffer.isBuffer(staged) && staged.length > 0,
      "Missing or empty packaged bytes: " + file);
    assert.ok(embedded.equals(staged), "Stale or altered packaged bytes: " + file);
  }
}

function verifyArtifact(kind, filename, tool) {
  assert.ok(kind === "apk" || kind === "aab", "Expected apk or aab");
  assert.ok(filename && tool, "Usage: check-android-artifact.mjs apk|aab ARTIFACT AAPT_OR_BUNDLETOOL");
  const expected = sourceBuildInfo(root, true);
  let metadata;
  if (kind === "apk") {
    metadata = { ...parseApkBadging(run(tool, ["dump", "badging", filename])),
      widgetReleaseDirectPractice: parseApkWidgetPractice(run(tool, ["dump", "xmltree", filename, "AndroidManifest.xml"])) };
  } else {
    assert.equal(expected.variant, "release", "AAB must use release variant");
    assert.equal(expected.widgetPractice, "release-enabled", "AAB must include direct practice");
    run("java", ["-jar", tool, "validate", "--bundle=" + filename]);
    const dump = path => run("java", ["-jar", tool, "dump", "manifest", "--bundle=" + filename, "--xpath=" + path]).trim();
    metadata = {
      applicationId: dump("/manifest/@package"),
      versionCode: dump("/manifest/@android:versionCode"),
      versionName: dump("/manifest/@android:versionName"),
      minSdk: dump("/manifest/uses-sdk/@android:minSdkVersion"),
      targetSdk: dump("/manifest/uses-sdk/@android:targetSdkVersion"),
      debuggable: parseBundleDebuggable(dump("/manifest/application/@android:debuggable")),
      widgetReleaseDirectPractice: parseBundleWidgetPractice(dump("/manifest/application/meta-data/@android:name"),
        run("java", ["-jar", tool, "dump", "manifest", "--bundle=" + filename])),
    };
  }
  const prefix = assetPrefix(kind);
  const assets = run("unzip", ["-Z1", filename]).trim().split(/\r?\n/);
  const embedded = JSON.parse(run("unzip", ["-p", filename, prefix + "build-info.json"]));
  verifyArtifactMetadata({ metadata, embedded, assets, expected, kind });
  verifyPackagedAssetBytes({
    kind, widgetPractice: expected.widgetPractice,
    readEmbedded: file => readArchive(filename, file),
    readStaged: file => readFileSync(resolve(root, "mobile/www-packaged-guest", file)),
  });
  assert.ok(readArchive(filename, prefix + "app.js").length > 30000, "Packaged JS is unexpectedly empty");
  console.log("PASS: " + kind + " metadata, debuggable=" + metadata.debuggable +
    ", embedded build-info and packaged asset bytes match " + JSON.stringify(expected));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyArtifact(...process.argv.slice(2));
}
