/**
 * Guest-only packaged Android app readiness gate.
 * Never remove previously scheduled reminders while the current local
 * repository is opening or rolling over to a new calendar day.
 * Explicit opt-out still removes the owned notifications.
 */
import { localDayKey } from "./reminder-plan.js";

export function guestReminderAction(optIn, snapshot, now = new Date()) {
  if (!optIn) return "disable";
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("현재 단말 시간을 확인하지 못했습니다.");
  }
  if (!snapshot || !Array.isArray(snapshot.habits)) return "await-snapshot";
  if (snapshot.day !== localDayKey(now, snapshot.timeZone)) return "await-today";
  return "sync";
}

/** A login may emit an empty local snapshot before cloud hydration and today's
 * entries exist. Neither an inherited opt-out nor an invitation can be
 * derived from that incomplete snapshot. Explicit account-scope cleanup is
 * separate. Also avoid replaying yesterday's snapshot after a clock change. */
export function isReminderSnapshotReady(snapshot, memberUserId, now = new Date()) {
  if (!snapshot || !Array.isArray(snapshot.habits) || !snapshot.history ||
      !Object.hasOwn(snapshot.history, snapshot.day) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) return false;
  const member = typeof memberUserId === "string" && memberUserId.length > 0;
  if (member && (snapshot.state?.hydrated !== true ||
      typeof snapshot.state.timezone !== "string" || !snapshot.state.timezone)) return false;
  try {
    return snapshot.day === localDayKey(now, member ? snapshot.state.timezone : undefined);
  } catch {
    return false;
  }
}
