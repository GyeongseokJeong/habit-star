import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createResumeDispatcher } from "../notifications/native-resume-refresh.js";

test("native + visibility events within the debounce window refresh only once", () => {
  let time=1000, calls=0;
  const resume=createResumeDispatcher(()=>{calls+=1;},{clock:()=>time,minGapMs:800});
  assert.equal(resume(),true);
  time=1100;
  assert.equal(resume(),false);
  time=1799;
  assert.equal(resume(),false);
  time=1800;
  assert.equal(resume(),true);
  assert.equal(calls,2);
});
test("invalid clocks and configuration cannot spam refresh events", () => {
  let calls=0;
  const resume=createResumeDispatcher(()=>{calls+=1;},{clock:()=>NaN});
  assert.equal(resume(),false);
  assert.equal(calls,0);
  assert.throws(()=>createResumeDispatcher(null));
  assert.throws(()=>createResumeDispatcher(()=>{}, {minGapMs:-1}));
});
test("native package refreshes real repository snapshot before scheduling", () => {
  const root=resolve(import.meta.dirname,"../..");
  const entry=readFileSync(resolve(root,"mobile/packaged-guest/main.tsx"),"utf8");
  const store=readFileSync(resolve(root,"lib/habits/use-habit-app.ts"),"utf8");
  assert.match(entry,/App\.addListener\("appStateChange"/);
  assert.match(entry,/window\.dispatchEvent\(new Event\("byeolharu:native-resume"\)\)/);
  assert.match(store,/window\.addEventListener\("byeolharu:native-resume", nativeResume\)/);
  assert.match(store,/window\.removeEventListener\("byeolharu:native-resume", nativeResume\)/);
  assert.match(store,/await r\.ensureDay\(\);\s*await refresh\(r\)/);
  assert.doesNotMatch(entry,/setInterval\(/);
});
