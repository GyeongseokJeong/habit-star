import { runColdWidgetPractice, type ColdWidgetResult } from "./widget-cold-practice";
import type { ColdReminderTarget, ColdReminderInventory } from "./cold-reminder-transport";
declare global {
  interface Window {
    ByeolharuColdGate?: { allowed(): boolean };
    __byeolharuColdStart?: (actionKey: string, deadline: number, nativeDeadline: number) => void;
    __byeolharuColdResult?: ColdWidgetResult;
    __byeolharuColdPrepare?: ColdReminderTarget;
    __byeolharuColdPrepared?: (json: string) => void;
  }
}
let started = false;
window.__byeolharuColdStart = (actionKey, deadline, nativeDeadline) => {
  if (started) return;
  started = true;
  void runColdWidgetPractice({
    origin: window.location.origin, actionKey, deadline, storage: localStorage,
    nativeAllowed: () => window.ByeolharuColdGate?.allowed() === true,
    reminderTransport: {
      // One read-only prepare response through the existing result poll.
      // No JavascriptInterface method accepts IDs, payloads or mutations.
      prepare: target => new Promise<ColdReminderInventory | null>(resolve => {
        const remaining=Math.min(1000, nativeDeadline-Date.now()-500);
        if (remaining<=0) { resolve(null); return; }
        const finish=(value: ColdReminderInventory | null)=>{
          clearTimeout(timer);
          delete window.__byeolharuColdPrepared;
          delete window.__byeolharuColdPrepare;
          resolve(value);
        };
        const timer=setTimeout(()=>finish(null),remaining);
        window.__byeolharuColdPrepared = json => {
          try { finish(JSON.parse(json)); } catch { finish(null); }
        };
        window.__byeolharuColdPrepare = target;
      }),
    },
  }).then(result => { window.__byeolharuColdResult = result; })
    .catch(() => { window.__byeolharuColdResult = {status:"error"}; });
};
