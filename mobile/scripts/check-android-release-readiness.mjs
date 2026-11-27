/**
 * Source configuration audit only. A generated Android project is intentional:
 * the versioned config, native templates and patcher are the build inputs.
 * Never sign, upload, publish, access secrets or infer manual release approval.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAndroidVersion } from "./android-release-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function inspectReleaseSources({ config, workflow, patcher, packageJson, versionJson, artifactVerifier, lockJson }) {
  for (const source of [config, workflow, patcher, artifactVerifier]) assert.equal(typeof source, "string");
  const pkg = typeof packageJson === "string" ? JSON.parse(packageJson) : packageJson;
  const stripComments = source => source.replace(/^\s*(?:\/\/|\/\*|\*|#).*$/gm, "");
  const cfg = stripComments(config);
  const ci = stripComments(workflow);
  const patch = stripComments(patcher);
  const blockers = [];
  const block = (id, description) => blockers.push({ id, description });
  let version = null;
  try {
    version = validateAndroidVersion(typeof versionJson === "string" ? JSON.parse(versionJson) : versionJson);
  } catch {
    block("INVALID_ANDROID_VERSION", "Expected valid code/name in mobile/release-version.json.");
  }
  if (!/process\.env\.BYEOLHARU_ANDROID_RELEASE === "1"\s*&&\s*\{\s*appId: "app\.byeolharu\.android",\s*appName: "별하루"/.test(cfg))
    block("RELEASE_APP_ID_OR_LABEL", "The release flag must select the release ID and label.");
  if (!cfg.includes('appId: "io.github.gyeongseokjeong.byeolharu.packagedgueststep9"'))
    block("DEBUG_APP_ID", "Preserve the existing installed test package.");
  if (!/patchGradleVersion\(gradle, readAndroidVersion\(mobileRoot\)\)/.test(patch) || !patch.includes("native/MainActivity.java.template"))
    block("UNVERSIONED_NATIVE_CONFIGURATION", "Generated native project must use versioned templates and shared Android version.");
  if (!/^\s*release-bundle:\s*$/m.test(ci) || !/^\s*BYEOLHARU_ANDROID_RELEASE: "1"\s*$/m.test(ci) || !/^\s*\.\/gradlew bundleRelease --no-daemon\s*$/m.test(ci))
    block("NO_RELEASE_BUNDLE_PIPELINE", "Expected a dedicated generated release AAB pipeline.");
  if (!/^\s*node mobile\/scripts\/check-android-artifact\.mjs aab /m.test(ci) ||
      !/node mobile\/scripts\/check-android-artifact\.mjs apk /m.test(ci) ||
      !/export function verifyArtifactMetadata\(/.test(stripComments(artifactVerifier)))
    block("NO_FINAL_ARTIFACT_VERIFICATION", "Verify final AAB/APK metadata and embedded build-info.");
  if (!/^\s*sign-internal:\s*$/m.test(ci) || !/^\s*environment: play-internal\s*$/m.test(ci) ||
      !/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.sign_internal/.test(ci) ||
      !/^\s*bash mobile\/scripts\/sign-aab\.sh unsigned\/app-release\.aab /m.test(ci) || !/assertNewPlayVersion\(readAndroidVersion\("mobile"\), process\.env\.PLAY_MAX_VERSION_CODE\)/.test(ci))
    block("NO_PROTECTED_SIGNING_PIPELINE", "Expected opt-in main-only signing in the play-internal environment.");
  let lockValid = false;
  try {
    const lock = typeof lockJson === "string" ? JSON.parse(lockJson) : lockJson;
    const rootPackage = lock.packages[""];
    assert.equal(lock.lockfileVersion, 3);
    for (const field of ["name", "version", "dependencies", "devDependencies", "engines"]) {
      assert.deepEqual(rootPackage[field], pkg[field]);
    }
    for (const [path, info] of Object.entries(lock.packages)) {
      if (path === "") continue;
      assert.match(info.resolved, /^https:\/\/registry\.npmjs\.org\//);
      assert.match(info.integrity, /^sha(?:512|1)-/);
    }
    lockValid = true;
  } catch {
    // npm ci verifies the full exact lock graph during CI.
  }
  if (!lockValid || (ci.match(/npm ci --no-audit --no-fund/g) ?? []).length !== 2 ||
      /npm install --no-package-lock/.test(ci))
    block("UNLOCKED_ANDROID_DEPENDENCIES", "Both Android jobs must use a valid committed npm lock via npm ci.");
  if (pkg.private !== true) block("UNEXPECTED_PACKAGE_BOUNDARY", "Android build tooling must remain private.");

  return {
    // Preserve the old ready field as fail-closed; static configuration can never
    // prove permission, installed-app signature, Play Console or device readiness.
    ready: false,
    sourceReady: blockers.length === 0,
    version,
    blockers,
    manualGates: [
      "Verify final AAB/APK package, launcher label, version code/name, target/min SDK, embedded source SHA and release widget read-only boundary in CI",
      "Confirm highest versionCode ever used in Play Console; choose a higher unused code before the next upload",
      "Verify repeatable clean builds from the locked dependency graph; byte-identical artifacts are not guaranteed across toolchain versions or disposable certificates",
      "Verify Play App Signing/upload-key custody and the actual signed AAB in internal testing",
      "Verify same-package Play update with prior app signing certificate; never assume disposable test APK compatibility",
      "Verify guest/member records, backups, Outbox, account isolation and auth callback preservation without deleting original data",
      "Verify launcher, splash, accessibility, light/dark, permissions and notification end-to-end behavior on devices",
      "Verify Play Store listing, privacy policy, Data Safety and required declarations",
      "Verify external backup and isolated restoration before public beta (#147)",
      "Obtain explicit release approval after required evidence; source audit cannot approve publication",
    ],
  };
}

export function loadReleaseSources() {
  return {
    config: readFileSync(resolve(root, "capacitor.config.ts"), "utf8"),
    workflow: readFileSync(resolve(root, "../.github/workflows/android-poc.yml"), "utf8"),
    patcher: readFileSync(resolve(root, "scripts/patch-android.mjs"), "utf8"),
    packageJson: readFileSync(resolve(root, "package.json"), "utf8"),
    versionJson: readFileSync(resolve(root, "release-version.json"), "utf8"),
    lockJson: readFileSync(resolve(root, "package-lock.json"), "utf8"),
    artifactVerifier: readFileSync(resolve(root, "scripts/check-android-artifact.mjs"), "utf8"),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = inspectReleaseSources(loadReleaseSources());
  console.log(JSON.stringify(audit, null, 2));
  if (process.argv.includes("--assert-source-ready") && !audit.sourceReady) process.exitCode = 1;
  if (process.argv.includes("--assert-ready")) {
    console.error("--assert-ready cannot prove publication readiness; use --assert-source-ready for source checks only.");
    process.exitCode = 1;
  }
}
