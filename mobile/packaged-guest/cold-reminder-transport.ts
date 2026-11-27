import type { Snapshot } from "../../lib/habits/repository";
import type { WidgetPracticeCommand } from "../../lib/habits/widget-practice";
import { planColdWidgetReminder } from "../notifications/cold-widget-reminder.js";

import { HABIT_REMINDER_OPT_IN_KEY, WRAPUP_REMINDER_STORAGE_PREFIX } from "./reminder-preferences";

export type ColdReminderTarget = {
  scope: string; day: string; habitId: string; timeZone: string; completed: boolean;
};
export type ColdReminderInventory = {
  permissionGranted: boolean; exact: boolean;
  queue: { storedIds: number[]; scheduledIds: number[]; visibleIds: number[]; saved: unknown[] };
};
export type ColdReminderTransport = {
  prepare(target: ColdReminderTarget): Promise<ColdReminderInventory | null>;
};
export type ColdReminderDecision = ReturnType<typeof planColdWidgetReminder>;
const defer = (reason: string) => ({kind:"defer" as const, reason});

/** Post-commit only. No native mutation here. The detached native runtime
 * consumes one decision after re-reading its own complete inventory. */
export async function decideCommittedColdReminder(input: {
  snapshot: Snapshot; command: WidgetPracticeCommand; memberId: string | null;
  storage: Pick<Storage, "getItem">; allowed: () => boolean;
  freshSnapshot: () => Promise<Snapshot | null>; transport: ColdReminderTransport;
}): Promise<ColdReminderDecision> {
  try {
    const {snapshot,command,memberId,storage,allowed,freshSnapshot,transport} = input;
    if (!allowed()) return defer("stale-commit");
    const readPrefs = () => ({
      optInRaw: storage.getItem(HABIT_REMINDER_OPT_IN_KEY),
      wrapupRaw: storage.getItem(WRAPUP_REMINDER_STORAGE_PREFIX + command.scope),
    });
    const prefs = readPrefs();
    // Evaluate policy and invalid/stale cases without exposing native data.
    // Completion still needs the actual inventory: today's edited schedule
    // may be past while its earlier canonical reservation is still pending.
    const initial = planColdWidgetReminder({snapshot, command, memberId, ...prefs,
      permissionGranted:true, exact:false,
      queue:{storedIds:[],scheduledIds:[],visibleIds:[],saved:[]}});
    if (initial.kind === "defer" ||
        (initial.kind === "noop" && "reason" in initial &&
          (initial.reason === "opted-out-or-unconfigured" || (!command.completed && initial.reason === "no-future-target"))))
      return initial;
    const timeZone = memberId ? snapshot.state.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone;
    let prepared: ColdReminderInventory | null=null;
    try {
      prepared=await transport.prepare({
        scope:command.scope, day:command.day, habitId:command.habitId, completed:command.completed, timeZone,
      });
    } catch { /* even a failed prepare needs a fresh commit/projection check */ }
    if (!allowed()) return defer("stale-commit");
    let fresh: Snapshot | null;
    try { fresh=await freshSnapshot(); }
    catch { return defer("stale-commit"); }
    if (!fresh || !allowed() || fresh.state.localRevision !== command.revision+1 ||
        timeZone !== (memberId ? fresh.state.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone))
      return defer("stale-commit");
    let latestPrefs: ReturnType<typeof readPrefs>;
    try { latestPrefs=readPrefs(); }
    catch { return defer("stale-commit"); }
    const decision=planColdWidgetReminder({snapshot:fresh, command, memberId, ...latestPrefs,
      permissionGranted:prepared?.permissionGranted ?? false, exact:prepared?.exact ?? false,
      queue:prepared?.queue ?? {storedIds:[],scheduledIds:[],visibleIds:[],saved:[]}});
    if (decision.kind==="defer" && "reason" in decision && decision.reason==="stale-commit") return decision;
    if (prefs.optInRaw !== latestPrefs.optInRaw || prefs.wrapupRaw !== latestPrefs.wrapupRaw)
      return defer("preferences-changed");
    return prepared ? decision : defer("transport-unavailable");
  } catch { return defer("transport-unavailable"); }
}
