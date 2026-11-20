import test from "node:test";
import assert from "node:assert/strict";
import { classifyIntegrationFiles, SHARED_REVIEW_FILES } from "./check-integration-scope.mjs";

test("expected Android stack is clean only with explicit shared-file review",()=>{
 const expected=[
   "mobile/capacitor.config.ts",
   "mobile/scripts/check-integration-scope.mjs",
   ".github/workflows/android-poc.yml",
   ...SHARED_REVIEW_FILES,
 ];
 const report=classifyIntegrationFiles(expected);
 assert.equal(report.scopeClean,true);
 assert.equal(report.totals.sharedReview,7);
 assert.equal(report.totals.rejected,0);
 assert.deepEqual(report.sharedReviewRequired,[...SHARED_REVIEW_FILES].sort());
 assert.match(report.note,/NOT a merge approval/);
});
test("changes outside Android allowlist are rejected",()=>{
 for(const file of [
   "app/page.tsx","package.json",".github/workflows/ci.yml",
   "supabase/migrations/20260101000000.sql", "components/other.tsx",
   "mobile/android/app/build.gradle","mobile/www-packaged-guest/main.js",
   "mobile/.env.production","mobile/secrets/release.jks",
   "mobile/google-services.json","../outside.txt",
 ]){
  const report=classifyIntegrationFiles(["mobile/README.md",file]);
  assert.equal(report.scopeClean,false,file);
  assert.equal(report.totals.rejected,1,file);
 }
});
test("duplicate paths and invalid file lists fail safely",()=>{
 assert.equal(classifyIntegrationFiles([]).scopeClean,false);
 assert.equal(classifyIntegrationFiles(["mobile/a.js","mobile/a.js"]).totals.mobile,1);
 assert.throws(()=>classifyIntegrationFiles(null));
});
