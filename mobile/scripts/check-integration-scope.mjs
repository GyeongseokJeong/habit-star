/**
 * STEP 20 — read-only Android integration scope gate.
 *
 * Compares the current stacked Android branch to app/main, not to its
 * immediately preceding PR. CI fails on unexpected shared/production files,
 * generated Android output, private signing material or secrets.
 *
 * Passing this check does NOT approve the shared-file changes or authorize a
 * merge, app-ID change, signing operation, or store upload.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const SHARED_REVIEW_FILES = Object.freeze([
  "app/globals.css",
  "components/account/account-panel.tsx",
  "components/byeolharu.tsx",
  "lib/habits/native-reminder-controls.ts",
  "lib/habits/use-habit-app.ts",
  "tests/e2e/habit-editor-balanced.spec.ts",
  "tsconfig.json",
]);
const sharedReview = new Set(SHARED_REVIEW_FILES);
const allowedWorkflow = ".github/workflows/android-poc.yml";
const secretOrGenerated = /(?:^|\/)(?:\.env(?:\.local|\.production|\.development)?|google-services\.json|[^/]+\.(?:jks|keystore|p12|p8|pem|key))$/i;
const generatedAndroid = /^mobile\/(?:android|www-packaged-guest)\//;

export function classifyIntegrationFiles(files) {
  assert.ok(Array.isArray(files), "Expected a git file list");
  const mobile = [], workflows = [], shared = [], rejected = [];
  for (const path of [...new Set(files)]) {
    if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("..") || path.includes("\0")) {
      rejected.push({path, reason:"Invalid or unexpected file path"});
    } else if (secretOrGenerated.test(path) || generatedAndroid.test(path)) {
      rejected.push({path, reason:"Generated artifact or private configuration is not allowed in this PoC"});
    } else if (path.startsWith("mobile/")) {
      mobile.push(path);
    } else if (path === allowedWorkflow) {
      workflows.push(path);
    } else if (sharedReview.has(path)) {
      shared.push(path);
    } else {
      rejected.push({path, reason:"Outside the reviewed Android integration scope"});
    }
  }
  return {
    scopeClean: rejected.length === 0 && files.length > 0,
    totals: {changed: files.length, mobile:mobile.length, workflows:workflows.length, sharedReview:shared.length, rejected:rejected.length},
    sharedReviewRequired: shared.sort(),
    rejected,
    note:"A clean path scope is NOT a merge approval. Review each shared diff and obtain explicit authorization before integration.",
  };
}

export function changedFilesFromGit(base = "origin/app/main") {
  assert.equal(base, "origin/app/main", "Integration gate must always compare against origin/app/main");
  const bytes = execFileSync("git", ["diff", "--name-only", "-z", "--no-ext-diff", base + "...HEAD"], {
    cwd: repoRoot,
    maxBuffer: 16 * 1024 * 1024,
  });
  return bytes.toString("utf8").split("\0").filter(Boolean);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = classifyIntegrationFiles(changedFilesFromGit());
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes("--assert-scope") && !report.scopeClean) process.exitCode = 1;
}
