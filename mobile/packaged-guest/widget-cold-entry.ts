import { runColdWidgetPractice, type ColdWidgetResult } from "./widget-cold-practice";
declare global {
  interface Window {
    ByeolharuColdGate?: { allowed(): boolean };
    __byeolharuColdStart?: (actionKey: string, deadline: number) => void;
    __byeolharuColdResult?: ColdWidgetResult;
  }
}
let started = false;
window.__byeolharuColdStart = (actionKey, deadline) => {
  if (started) return;
  started = true;
  void runColdWidgetPractice({
    origin: window.location.origin, actionKey, deadline, storage: localStorage,
    nativeAllowed: () => window.ByeolharuColdGate?.allowed() === true,
  }).then(result => { window.__byeolharuColdResult = result; })
    .catch(() => { window.__byeolharuColdResult = {status:"error"}; });
};
