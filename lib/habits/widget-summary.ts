import { dateKey, isScheduled, type TimeGroup } from "./domain";
import { startupDataReady } from "./time-tab";
import type { Snapshot } from "./repository";
import { getFirstUseState } from "./onboarding";
import { sortHabitsForDisplay } from "./display-order";

export type WidgetRow = { title: string; icon: string; group: TimeGroup; completed: boolean };
export type WidgetSummary = { ready: true; expiresAt: number; timezone: string; rows: WidgetRow[] };

/** First millisecond of next local calendar day, including DST. */
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

/** Display-only projection: no record IDs, notes, identity, tokens or growth data. */
export function buildWidgetSummary(snapshot: Snapshot | null, memberId: string | null, now = new Date()): WidgetSummary | null {
  if (!snapshot || !startupDataReady(Boolean(memberId), snapshot) ||
      !Object.hasOwn(snapshot.history, snapshot.day)) return null;
  const timezone = memberId ? snapshot.state.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (snapshot.day !== dateKey(now, timezone)) return null;
  const samples = getFirstUseState(snapshot, Boolean(memberId)).sampleIds;
  const scheduled = snapshot.habits.filter(h => !samples.has(h.id) && isScheduled(h, snapshot.day));
  // Stable time order; do not immediately move rows on completion.
  return { ready: true, expiresAt: widgetExpiry(now, timezone), timezone,
    rows: sortHabitsForDisplay(scheduled).map(h => ({ title: h.title, icon: h.icon, group: h.timeGroup, completed: h.completed })) };
}
