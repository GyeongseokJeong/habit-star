import test from "node:test";
import assert from "node:assert/strict";
import { inspectReleaseSources, loadReleaseSources } from "./check-android-release-readiness.mjs";

const sources = loadReleaseSources();

test("current debug PoC is explicitly not marked ready for Play publishing", () => {
  const report = inspectReleaseSources(sources);
  assert.equal(report.ready, false);
  assert.ok(report.blockers.some(x => x.id === "DEBUG_APP_ID"));
  assert.ok(report.blockers.some(x => x.id === "DEBUG_APP_LABEL"));
  assert.ok(report.blockers.some(x => x.id === "NO_RELEASE_BUNDLE_PIPELINE"));
  assert.ok(report.blockers.some(x => x.id === "NO_UPLOAD_SIGNING_PIPELINE"));
  assert.ok(report.manualGates.some(x => /PRs/.test(x)));
});

test("release readiness is machine-readable and avoids touching secrets", () => {
  const report = inspectReleaseSources(sources);
  assert.ok(report.blockers.every(x => typeof x.id === "string" && typeof x.description === "string"));
  assert.ok(report.manualGates.length >= 8);
  const stable = JSON.stringify(report);
  assert.equal(JSON.stringify(inspectReleaseSources(sources)), stable);
  assert.doesNotMatch(stable, /-----BEGIN PRIVATE KEY-----|PASSWORD=/);
});

test("release-only synthetic sources can pass static checks without assuming manual approval", () => {
  const cfg = sources.config.replaceAll("packagedgueststep9", "release").replaceAll("별하루 비회원 STEP 9", "별하루");
  const workflow = sources.workflow + "\n# bundleRelease upload-key signingConfig signing";
  const patcher = "function configureRelease() { /* versioned release native project */ }";
  const sample = inspectReleaseSources({
    config: cfg, workflow, patcher,
    packageJson: JSON.stringify({private:true,description:"Android release PoC source audit"}),
  });
  assert.equal(sample.ready, true);
  assert.ok(sample.manualGates.length > 0, "Human release review must never be silently approved");
});

test("bad source inputs fail rather than reporting a false success", () => {
  assert.throws(() => inspectReleaseSources({config:null,workflow:"",patcher:"",packageJson:"{}"}));
});
