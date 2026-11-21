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
