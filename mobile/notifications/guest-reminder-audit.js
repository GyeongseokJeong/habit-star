/**
 * STEP 14: read-only verification that Android's pending guest alarms match
 * the saved habit snapshot. No permission request, no schedule/cancel writes.
 * Diagnostic only: a matching queue does not guarantee on-time delivery.
 */
import { localDayKey, REMINDER_KIND } from "./reminder-plan.js";
import {
  buildScopedReminderPlan,
  diffScopedNotifications,
} from "./scoped-reminder-runtime.js";

function pendingGuest(pending) {
  return pending.filter(item =>
    item?.extra?.kind === REMINDER_KIND && item?.extra?.scope === "guest",
  );
}

export function auditGuestReminders({
  snapshot,
  optIn,
  pending,
  permission,
  now = new Date(),
} = {}) {
  if (!Array.isArray(pending) || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("Android 예약 진단 입력이 올바르지 않습니다.");
  }

  const actualCount = pendingGuest(pending).length;
  if (optIn !== true) {
    return {
      status: actualCount ? "unexpected-pending" : "disabled",
      expectedCount: 0,
      actualCount,
      missingCount: 0,
      staleCount: actualCount,
      unchangedCount: 0,
      horizonDays: 8,
      truncated: false,
    };
  }
  if (permission !== "granted") {
    return {
      status: "permission-required",
      actualCount,
      expectedCount: null,
      missingCount: null,
      staleCount: null,
      unchangedCount: null,
      horizonDays: 8,
      truncated: false,
    };
  }
  if (!snapshot || snapshot.day !== localDayKey(now) || !Array.isArray(snapshot.habits)) {
    return {
      status: "snapshot-not-ready",
      actualCount,
      expectedCount: null,
      missingCount: null,
      staleCount: null,
      unchangedCount: null,
      horizonDays: 8,
      truncated: false,
    };
  }

  const desired = buildScopedReminderPlan(snapshot, {
    scope: "guest",
    now,
    daysAhead: 8,
  });
  const diff = diffScopedNotifications(pending, desired);

  return {
    status: diff.cancel.length || diff.schedule.length ? "out-of-sync" : "synced",
    expectedCount: diff.desiredCount,
    actualCount,
    missingCount: diff.schedule.length,
    staleCount: diff.cancel.length,
    unchangedCount: diff.unchanged,
    horizonDays: 8,
    truncated: desired.truncated,
  };
}
