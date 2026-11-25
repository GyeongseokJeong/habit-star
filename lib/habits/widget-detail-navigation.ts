import { buildWidgetSummary, widgetHabits, type WidgetSummary } from "./widget-summary";
import type { Snapshot } from "./repository";
import type { HabitReminderTarget } from "./reminder-navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function keys(snapshot: Snapshot, memberId: string | null, secret: string, now: Date) {
  const summary = buildWidgetSummary(snapshot, memberId, now);
  if (!summary || !UUID.test(secret)) return [];
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const scope = memberId ? "member:" + memberId : "guest";
  return Promise.all(widgetHabits(snapshot, memberId).map(async habit => {
    const target = {scope, day:snapshot.day, habitId:habit.id};
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify([
      "byeolharu-widget-detail-v1", scope, snapshot.day, habit.id,
    ]))));
    const hex = Array.from(bytes.slice(0,16), b=>b.toString(16).padStart(2,"0")).join("");
    return {target, key:[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-")};
  }));
}

/** Stable for the same scope/day/habit, unlike revision-bound write handles.
 * Neither the native cache nor the tap receives an account or record ID. */
export async function attachWidgetDetailKeys(summary: WidgetSummary, snapshot: Snapshot, memberId: string | null,
    secret: string, now = new Date()): Promise<WidgetSummary> {
  const handles = await keys(snapshot,memberId,secret,now);
  if (handles.length !== summary.rows.length || summary.expiresAt <= now.getTime()) return summary;
  return {...summary, rows:summary.rows.map((row,i)=>({...row,detailKey:handles[i].key}))};
}

/** Only the already selected, hydrated application scope is examined. No writes. */
export async function resolveWidgetDetailKey(snapshot: Snapshot, memberId: string | null,
    secret: string, detailKey: string, now = new Date()): Promise<HabitReminderTarget | null> {
  if (!UUID.test(detailKey)) return null;
  return (await keys(snapshot,memberId,secret,now)).find(row=>row.key===detailKey)?.target ?? null;
}
