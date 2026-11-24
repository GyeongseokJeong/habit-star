import test from "node:test";
import assert from "node:assert/strict";
import {mergeReminderLedger,measureReminderLatency,formatReminderDelay} from "../notifications/reminder-latency.js";
const now = new Date("2026-11-24T09:00:00+09:00");
test("keeps recent past and valid future alarms, drops stale cancelled future ones", () => {
 const ledger=mergeReminderLedger([{id:1,at:now.getTime()-60000},
   {id:2,at:now.getTime()+50000},{id:3,at:now.getTime()-3*86400000}],
   [{id:4,at:new Date(now.getTime()+10000)}], now);
 assert.deepEqual(ledger.map(x=>x.id),[1,4]);
});
test("compares still-visible OS post time to scheduled target", () => {
 const at=now.getTime()-500000;
 const measurement=measureReminderLatency([
   {id:17,postedAt:at+7*60000},{id:19,postedAt:at+9*60000}],
   [{id:17,at}],now);
 assert.equal(measurement.count,1);
 assert.equal(measurement.maxMs,420000);
 assert.equal(formatReminderDelay(measurement.meanMs),"7분 00초");
 assert.equal(measureReminderLatency([],[],now).count,0);
});
