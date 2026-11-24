/**
 * Best-effort, Android-only delivery-delay samples from currently visible posts.
 * Stores just app notification IDs and target timestamps on this device.
 * Dismissed posts cannot be recovered by NotificationManager.
 */
const WINDOW_MS = 48 * 60 * 60 * 1000;
export function mergeReminderLedger(previous, planned, now = new Date()) {
  const timestamp = now.getTime();
  const old = Array.isArray(previous) ? previous.filter(row =>
    Number.isInteger(row?.id) && Number.isFinite(row?.at) &&
    row.at <= timestamp && row.at >= timestamp - WINDOW_MS) : [];
  const byId = new Map(old.map(row => [row.id, { id: row.id, at: row.at }]));
  for (const item of planned ?? []) {
    const at = item?.at instanceof Date ? item.at.getTime() : NaN;
    if (Number.isInteger(item?.id) && Number.isFinite(at) && at > timestamp) {
      byId.set(item.id, { id: item.id, at });
    }
  }
  return [...byId.values()].sort((a,b)=>a.at-b.at).slice(-160);
}
export function measureReminderLatency(posts, ledger, now = new Date()) {
  const target = new Map((Array.isArray(ledger) ? ledger : [])
    .filter(item=>Number.isInteger(item?.id) && Number.isFinite(item?.at))
    .map(item=>[item.id,item.at]));
  const used = new Set();
  const delays = [];
  for (const post of Array.isArray(posts) ? posts : []) {
    if (!Number.isInteger(post?.id) || used.has(post.id)) continue;
    used.add(post.id);
    const at = target.get(post.id);
    if (!Number.isFinite(at) || at > now.getTime() || at < now.getTime()-WINDOW_MS) continue;
    if (!Number.isFinite(post.postedAt) || post.postedAt < at-60_000 ||
        post.postedAt > now.getTime()+60_000) continue;
    delays.push(Math.max(0, post.postedAt-at));
  }
  return {
    count: delays.length,
    meanMs: delays.length ? Math.round(delays.reduce((a,b)=>a+b,0)/delays.length) : null,
    maxMs: delays.length ? Math.max(...delays) : null,
  };
}
export function formatReminderDelay(ms) {
  if (!Number.isFinite(ms)) return "측정 불가";
  const seconds=Math.round(ms/1000);
  return `${Math.floor(seconds/60)}분 ${String(seconds%60).padStart(2,"0")}초`;
}
