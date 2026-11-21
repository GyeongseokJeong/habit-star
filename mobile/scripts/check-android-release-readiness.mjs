/**
 * STEP 19: source-only Android release readiness audit.
 *
 * The current app intentionally builds isolated, unsigned-for-Play debug APKs.
 * This script makes the release blockers explicit. Default mode reports them
 * without failing ordinary development CI. --assert-ready fails closed.
 * It NEVER signs, uploads, publishes, accesses secrets, or mutates files.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function inspectReleaseSources({config, workflow, patcher, packageJson}) {
  assert.equal(typeof config, "string");
  assert.equal(typeof workflow, "string");
  assert.equal(typeof patcher, "string");
  const pkg = typeof packageJson === "string" ? JSON.parse(packageJson) : packageJson;
  const blockers = [];
  const block = (id, description) => blockers.push({ id, description });
  // These are intentional blockers. Do not mistake the current PoC's
  // successful debug build for a shippable Android App Bundle.
  if (config.includes("packagedgueststep9"))
    block("DEBUG_APP_ID", "Current packaged guest uses a PoC application ID; configure the release build with app.byeolharu.android.");
  if (/별하루 비회원 STEP 9/.test(config))
    block("DEBUG_APP_LABEL", "Current launcher label includes STEP 9; configure the release launcher label as 별하루.");
  if (patcher.includes("cap add android") || /generated debug MainActivity|generated Android package/i.test(patcher) || /generated Android project/i.test(patcher))
    block("GENERATED_ANDROID_PROJECT", "Native project is generated and patched for debug; establish a versioned release configuration.");
  if (/assembleDebug/.test(workflow) && !/bundleRelease/.test(workflow))
    block("NO_RELEASE_BUNDLE_PIPELINE", "CI generates debug APKs only, not a release Android App Bundle.");
  if (!/signingConfig|upload[-_ ]?key|keystore|keyAlias/.test(workflow))
    block("NO_UPLOAD_SIGNING_PIPELINE", "No Play upload signing pipeline is configured (do not commit private keys).");
  if (pkg.private !== true || !/PoC|experiment|debug/i.test(pkg.description ?? ""))
    block("UNEXPECTED_POC_BOUNDARY", "PoC safeguards were changed; re-review the APK build boundary.");

  return {
    ready: blockers.length === 0,
    blockers,
    manualGates: [
      "Verify the release bundle applicationId app.byeolharu.android and launcher label 별하루 alongside the installed test app",
      "Release-target SDK verified from final generated Android build (Google Play new app: API 36+ as of Nov 2026)",
      "VersionCode/versionName and immutable upgrade strategy",
      "Versioned native Android release project and reproducible release AAB build",
      "Play App Signing/upload key secured outside git; signed AAB tested in internal testing",
      "Launcher icon, splash, accessibility, light/dark, permissions and notification end-to-end review",
      "Play Store listing, privacy policy, Data Safety and required declaration review",
      "Verify guest JSON restore and same-account member sync from the installed test app; preserve the original until records match",
      "Verify the release uses the shared main source and email callbacks reopen the requesting app with both packages installed",
      "Galaxy device regression of the latest permission-toggle change and release AAB verified",
    ],
  };
}

export function loadReleaseSources() {
  return {
    config: readFileSync(resolve(root, "capacitor.config.ts"), "utf8"),
    workflow: readFileSync(resolve(root, "../.github/workflows/android-poc.yml"), "utf8"),
    patcher: readFileSync(resolve(root, "scripts/patch-android.mjs"), "utf8"),
    packageJson: readFileSync(resolve(root, "package.json"), "utf8"),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = inspectReleaseSources(loadReleaseSources());
  console.log(JSON.stringify(audit, null, 2));
  if (process.argv.includes("--assert-ready") && !audit.ready) process.exitCode = 1;
}
