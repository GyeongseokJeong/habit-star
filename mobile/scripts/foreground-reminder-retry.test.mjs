import test from "node:test";
import assert from "node:assert/strict";
import { reconcileWithForegroundRetry } from "../notifications/foreground-reminder-retry.js";

test("successful sync never retries or requests permission", async () => {
  let calls=0;
  const result=await reconcileWithForegroundRetry({
    sync:async()=>{calls++;return {status:"unchanged"};},
    canRetry:()=>{throw Error("should not check");},
    wait:()=>{throw Error("should not wait");},
  });
  assert.equal(result.status,"unchanged");
  assert.equal(calls,1);
});

test("transient schedule failure retries only once with two safety checks", async () => {
  let calls=0,checked=0,delays=0;
  const result=await reconcileWithForegroundRetry({
    sync:async()=>{calls++;if(calls===1)throw Error("OEM schedule failure");return {status:"updated"};},
    canRetry:async()=>{checked++;return true;},
    wait:async()=>{delays++;},
  });
  assert.equal(result.status,"updated");
  assert.equal(calls,2);
  assert.equal(checked,2);
  assert.equal(delays,1);
});

test("blocked, stale, or background state never retries", async()=>{
  for(const responses of [[false],[true,false]]) {
    let calls=0,checked=0;
    await assert.rejects(reconcileWithForegroundRetry({
      sync:async()=>{calls++;throw Error("initial failure");},
      canRetry:async()=>responses[checked++],
      wait:async()=>{},
    }),/initial failure/);
    assert.equal(calls,1);
  }
});

test("persistent failure is propagated after a single bounded retry",async()=>{
  let calls=0;
  await assert.rejects(reconcileWithForegroundRetry({
    sync:async()=>{calls++;throw Error("still broken");},
    canRetry:async()=>true,
    wait:async()=>{},
  }),/still broken/);
  assert.equal(calls,2);
});

test("invalid or throwing safety adapters fail closed",async()=>{
  await assert.rejects(reconcileWithForegroundRetry({}),TypeError);
  let calls=0;
  await assert.rejects(reconcileWithForegroundRetry({
    sync:async()=>{calls++;throw Error("original error");},
    canRetry:async()=>{throw Error("permission unknown");},
    wait:async()=>{},
  }),/original error/);
  assert.equal(calls,1);
});
