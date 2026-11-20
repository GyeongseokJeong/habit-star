/**
 * Read-only diagnosis for the packaged Android guest app.
 * Does not mutate pending notifications, request permissions or inspect
 * reminders that belong to another account/package.
 */
import { REMINDER_KIND } from "./reminder-plan.js";

export function summarizeGuestPending(pending, now = new Date()) {
  if (!Array.isArray(pending) || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("알림 예약 목록을 확인할 수 없습니다.");
  }
  const owned = pending.filter(item =>
    item && item.extra?.kind === REMINDER_KIND && item.extra?.scope === "guest",
  );
  const ordered = owned.map(item => {
    const raw = item.schedule?.at;
    const at = raw instanceof Date ? raw : (typeof raw === "string" || typeof raw === "number") ? new Date(raw) : null;
    const parsed = at && Number.isFinite(at.getTime()) ? at : null;
    return { at: parsed, day: item.extra?.day };
  });
  const upcoming = ordered
    .filter(item => item.at && item.at.getTime() > now.getTime())
    .sort((a,b) => a.at - b.at);
  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const tomorrow = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  return {
    total: owned.length,
    todayRemaining: upcoming.filter(item => item.at >= today && item.at < tomorrow).length,
    nextAt: upcoming.length ? upcoming[0].at.toISOString() : null,
    unknownTime: ordered.filter(item => !item.at).length,
  };
}
