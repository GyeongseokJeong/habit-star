/**
 * STEP 7: opt-in-only Android reminder lifecycle coordinator.
 *
 * This is a transport-agnostic module, NOT an application startup hook.
 * The caller must supply the current verified account identity and today's
 * committed LocalRepository Snapshot. Never read Supabase, IndexedDB or
 * browser auth state here. Nothing is scheduled unless optIn === true.
 *
 * Production wiring remains disabled until the Android app is packaged with
 * an audited identity/snapshot adapter and a user-facing permission control.
 */
import { REMINDER_KIND, DEMO_SCOPE } from "./reminder-plan.js";
import { requireReminderScope, buildScopedReminderPlan, reconcileScopedReminders } from "./scoped-reminder-runtime.js";

function identityScope(identity) {
  if (!identity || identity.verified !== true) return null;
  if (identity.kind === "guest") return "guest";
  if (identity.kind === "member" && typeof identity.userId === "string") {
    const scope = "member:" + identity.userId;
    try { return requireReminderScope(scope); }
    catch { return null; }
  }
  return null;
}

function belongsToLiveReminders(item) {
  if (item?.extra?.kind !== REMINDER_KIND) return false;
  const scope = item.extra.scope;
  if (scope === DEMO_SCOPE) return false;
  try {
    requireReminderScope(scope);
    return true;
  } catch {
    return false;
  }
}

/** Scope-only cancellation. Never touches the STEP 4/5 demo packages. */
async function cancelManaged(native, exceptScope = null) {
  const { notifications } = await native.getPending();
  if (!Array.isArray(notifications)) {
    throw new Error("Android 예약 목록을 확인할 수 없습니다.");
  }
  const ids = new Set();
  const cancel = [];
  for (const item of notifications) {
    if (!belongsToLiveReminders(item) || item.extra.scope === exceptScope) continue;
    if (!Number.isInteger(item.id) || ids.has(item.id)) {
      throw new Error("중복되거나 잘못된 예약 ID가 발견되었습니다.");
    }
    ids.add(item.id);
    cancel.push({ id: item.id });
  }
  if (cancel.length) await native.cancel({ notifications: cancel });
  return cancel.length;
}

function assertNativeAdapter(native) {
  for (const name of ["getPending", "cancel", "checkPermissions", "createChannel", "schedule"]) {
    if (typeof native?.[name] !== "function") {
      throw new Error("Android 로컬 알림 연결이 준비되지 않았습니다.");
    }
  }
}

/**
 * Explicitly call sync() after a committed snapshot, account transition,
 * permission change, or foreground resume. Repeated calls are serialized.
 * No automatic permission prompt, subscription or persistent identity cache.
 */
export function createReminderLifecycle({ localNotifications, now = () => new Date() }) {
  assertNativeAdapter(localNotifications);
  if (typeof now !== "function") throw new Error("시간 공급자가 올바르지 않습니다.");

  let queue = Promise.resolve();
  let revision = 0;

  function sync(context) {
    const current = ++revision;
    // Avoid retaining mutable session/snapshot references across queued work.
    const source = context && typeof context === "object" ? context : {};
    const identity = source.identity && typeof source.identity === "object"
      ? { ...source.identity } : null;
    const snapshot = source.snapshot && typeof source.snapshot === "object"
      ? {
          day: source.snapshot.day,
          habits: Array.isArray(source.snapshot.habits)
            ? source.snapshot.habits.map(h => h && typeof h === "object"
                ? { ...h, repeatDays: Array.isArray(h.repeatDays) ? [...h.repeatDays] : h.repeatDays }
                : h)
            : source.snapshot.habits,
        }
      : null;
    const optIn = source.optIn === true;

    const task = queue.then(async () => {
      if (current !== revision) return { status: "superseded" };
      const scope = identityScope(identity);
      // Explicit off or logout must remove ALL app-owned pending reminders,
      // without changing any habit data or cancelling the STEP 5 demo.
      if (!optIn) {
        const cancelled = await cancelManaged(localNotifications);
        return { status: "disabled", cancelled };
      }
      if (!scope) {
        const cancelled = await cancelManaged(localNotifications);
        return { status: "identity-unverified", cancelled };
      }
      let plan;
      try {
        plan = buildScopedReminderPlan(snapshot, { scope, now: now(), daysAhead: 8 });
      } catch (error) {
        // Do not leave stale reminders behind after malformed/stale data.
        const cancelled = await cancelManaged(localNotifications);
        return {
          status: "snapshot-not-ready",
          cancelled,
          reason: error instanceof Error ? error.message : "알림 준비 실패",
        };
      }
      // Removing previous users' reminders takes precedence over scheduling
      // the current user. A failure stops before new ones are created.
      const cancelledOtherScopes = await cancelManaged(localNotifications, scope);
      const result = await reconcileScopedReminders(localNotifications, plan);
      return {
        ...result,
        scope,
        cancelledOtherScopes,
        truncated: plan.truncated,
      };
    });
    queue = task.catch(() => undefined);
    return task;
  }

  return {
    sync,
    /** Call with a fresh snapshot; reusing a previous day's snapshot fails closed. */
    onForeground: sync,
    /** Logout/disconnect cleanup is independent of stale session state. */
    disable: () => sync({ optIn: false }),
  };
}
