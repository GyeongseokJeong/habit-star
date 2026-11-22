/**
 * STEP 15: explicitly initiated, guest-only native reminder repair.
 * This does NOT modify habit records, Supabase, account identity, permission
 * settings or any other notification scopes. Never call at app startup.
 */
import { localDayKey } from "./reminder-plan.js";
import { hasEnabledWrapup, normalizeWrapupSettings } from "./wrapup-reminders.js";
import {
  buildScopedReminderPlan,
  reconcileScopedReminders,
} from "./scoped-reminder-runtime.js";

export async function repairGuestReminders({
  localNotifications,
  snapshot,
  optIn,
  wrapupSettings,
  now = new Date(),
} = {}) {
  // A user must have explicitly opted in before any native reservation write.
  const wrapup = normalizeWrapupSettings(wrapupSettings);
  if (optIn !== true && !hasEnabledWrapup(wrapup)) return { status: "disabled", added: 0, cancelled: 0 };
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("단말 시간을 확인할 수 없습니다.");
  }
  if (!snapshot || !Array.isArray(snapshot.habits) || snapshot.day !== localDayKey(now)) {
    return { status: "snapshot-not-ready", added: 0, cancelled: 0 };
  }
  // Check; do NOT pop up the OS permission dialog.
  const permission = await localNotifications.checkPermissions();
  if (permission.display !== "granted") {
    return { status: "permission-required", added: 0, cancelled: 0 };
  }

  const desired = buildScopedReminderPlan(snapshot, {
    scope: "guest",
    now,
    daysAhead: 8,
    habitOptIn: optIn === true,
    wrapupSettings: wrapup,
  });
  // Reuses the production queue diff and its foreign-ID collision guard.
  // Only guest-owned jobs are cancelled/replaced. This can partly fail at
  // native level, so callers must present failures and allow retry.
  const result = await reconcileScopedReminders(localNotifications, desired);
  if (result.status === "permission-required") {
    return { status: "permission-required", added: 0, cancelled: 0 };
  }
  if (result.status !== "updated" && result.status !== "unchanged") {
    throw new Error("알림 예약 변경 결과를 확인할 수 없습니다.");
  }
  return {
    status: result.status === "updated" ? "repaired" : "already-synced",
    added: result.schedule?.length ?? 0,
    cancelled: result.cancel?.length ?? 0,
    truncated: desired.truncated,
  };
}
