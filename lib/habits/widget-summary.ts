import { dateKey, isScheduled, type TimeGroup } from "./domain";
import { startupDataReady } from "./time-tab";
import type { Snapshot } from "./repository";
import { getFirstUseState } from "./onboarding";
import { sortHabitsForDisplay } from "./display-order";
import { createWidgetPracticeCommand, type WidgetPracticeCommand } from "./widget-practice";

export type WidgetRow = { title: string; icon: string; group: TimeGroup; completed: boolean; actionKey?: string };
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
  const scheduled = widgetHabits(snapshot, memberId);
  // Stable time order; do not immediately move rows on completion.
  return { ready: true, expiresAt: widgetExpiry(now, timezone), timezone,
    rows: scheduled.map(h => ({ title: h.title, icon: h.icon, group: h.timeGroup, completed: h.completed })) };
}

function widgetHabits(snapshot: Snapshot, memberId: string | null) {
  const samples = getFirstUseState(snapshot, Boolean(memberId)).sampleIds;
  return sortHabitsForDisplay(snapshot.habits.filter(h => !samples.has(h.id) && isScheduled(h, snapshot.day)));
}

/** Experimental debug projection. Commands stay in the living WebView only.
 * A launcher row receives a random handle, never a scope, habit ID or rating.
 * Rebuilding the projection invalidates handles from previous snapshots.
 */
export function buildWidgetActionProjection(snapshot: Snapshot, memberId: string | null, now = new Date()) {
  const summary = buildWidgetSummary(snapshot, memberId, now);
  const commands = new Map<string, WidgetPracticeCommand>();
  if (!summary) return { summary, commands };
  const scope = memberId ? "member:" + memberId : "guest";
  const habits = widgetHabits(snapshot, memberId);
  for (const [index, habit] of habits.entries()) {
    const command = createWidgetPracticeCommand(snapshot, scope, habit.id);
    if (!command || command.expectedRating !== 0) continue;
    const key = crypto.randomUUID();
    commands.set(key, command);
    summary.rows[index].actionKey = key;
  }
  return { summary, commands };
}
