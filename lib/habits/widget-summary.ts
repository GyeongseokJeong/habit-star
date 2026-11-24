import { dateKey, isScheduled } from "./domain";
import { startupDataReady } from "./time-tab";
import type { Snapshot } from "./repository";
import { getFirstUseState } from "./onboarding";
import { calculateConstellationGrowth } from "../constellation/growth";
import { getConstellationStage } from "../constellation/art";

export type WidgetSummary = {
  ready: true; expiresAt: number; completed: number; total: number;
  morning: number; day: number; night: number; stage: number; points: number;
};

/** Find next calendar date boundary rather than adding 24h (DST-safe). */
export function widgetExpiry(now: Date, timezone?: string): number {
  const day = dateKey(now, timezone);
  let low = now.getTime(), high = low + 36 * 3600000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateKey(new Date(middle), timezone) === day) low = middle;
    else high = middle;
  }
  return high;
}

/** Read-only allowlisted projection. No identity, title, notes or IDs. */
export function buildWidgetSummary(snapshot: Snapshot | null, memberId: string | null, now = new Date()): WidgetSummary | null {
  if (!snapshot || !startupDataReady(Boolean(memberId), snapshot) ||
      !Object.hasOwn(snapshot.history, snapshot.day)) return null;
  const timezone = memberId ? snapshot.state.timezone : undefined;
  if (snapshot.day !== dateKey(now, timezone)) return null;
  const samples = getFirstUseState(snapshot, Boolean(memberId)).sampleIds;
  const scheduled = snapshot.habits.filter(h => !samples.has(h.id) && isScheduled(h, snapshot.day));
  const pending = scheduled.filter(h => !h.completed);
  const points = calculateConstellationGrowth(snapshot).totalPoints;
  return {
    ready: true, expiresAt: widgetExpiry(now, timezone),
    completed: scheduled.length - pending.length, total: scheduled.length,
    morning: pending.filter(h => h.timeGroup === "morning").length,
    day: pending.filter(h => h.timeGroup === "day").length,
    night: pending.filter(h => h.timeGroup === "night").length,
    stage: getConstellationStage(points).stage, points,
  };
}
