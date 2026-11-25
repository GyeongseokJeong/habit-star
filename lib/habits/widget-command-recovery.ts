import { buildWidgetActionProjection, type WidgetSummary } from "./widget-summary";
import type { Snapshot } from "./repository";
import type { WidgetPracticeCommand } from "./widget-practice";

/** Per-publication secret only. No user ID, habit ID, rating or auth state is persisted. */
export type WidgetCommandGeneration = { nonce: string; expiresAt: number };
type Projection = ReturnType<typeof buildWidgetActionProjection>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_TTL = 36 * 60 * 60 * 1000;

export function validWidgetCommandGeneration(value: unknown, now = Date.now()): value is WidgetCommandGeneration {
  if (!value || typeof value !== "object") return false;
  const g = value as WidgetCommandGeneration;
  return typeof g.nonce === "string" && UUID.test(g.nonce) &&
    Number.isSafeInteger(g.expiresAt) && g.expiresAt > now && g.expiresAt - now <= MAX_TTL;
}

export function newWidgetCommandGeneration(summary: WidgetSummary): WidgetCommandGeneration {
  return { nonce: crypto.randomUUID(), expiresAt: summary.expiresAt };
}

async function signer(g: WidgetCommandGeneration) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(g.nonce),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return async (c: WidgetPracticeCommand) => {
    // Domain separation and explicit, ordered fields prevent ambiguous encodings.
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify([
      "byeolharu-widget-command-v1", g.expiresAt, c.scope, c.day, c.habitId,
      c.revision, c.version, c.expectedCompleted, c.expectedRating, c.completed,
    ]))));
    const hex = Array.from(bytes.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join("-");
  };
}

/** Remap the existing validated projection; the launcher still gets only opaque UUID-shaped handles. */
export async function recoverableWidgetProjection(projection: Projection, generation: WidgetCommandGeneration, now = Date.now()): Promise<Projection> {
  if (!projection.summary || !validWidgetCommandGeneration(generation, now) ||
      projection.summary.expiresAt !== generation.expiresAt) throw Error("widget_generation_invalid");
  const sign = await signer(generation);
  const commands = new Map<string, WidgetPracticeCommand>();
  const rows = await Promise.all(projection.summary.rows.map(async row => {
    if (!row.actionKey) return { ...row };
    const command = projection.commands.get(row.actionKey);
    if (!command) throw Error("widget_command_missing");
    const key = await sign(command);
    if (commands.has(key)) throw Error("widget_key_collision");
    commands.set(key, command);
    return { ...row, actionKey: key };
  }));
  return { summary: { ...projection.summary, rows }, commands };
}

/** Read-only recovery contract. Caller MUST independently authenticate the active scope,
 * load its existing committed snapshot, and validate native consent/claim/deadline.
 * Never choose an account from a handle or apply the command here.
 */
export async function recoverWidgetPracticeCommand(snapshot: Snapshot, verifiedMemberId: string | null,
    actionKey: string, generation: WidgetCommandGeneration, now = new Date()): Promise<WidgetPracticeCommand | null> {
  if (!UUID.test(actionKey) || !validWidgetCommandGeneration(generation, now.getTime())) return null;
  const projection = buildWidgetActionProjection(snapshot, verifiedMemberId, now);
  if (!projection.summary || projection.summary.expiresAt !== generation.expiresAt) return null;
  try {
    const recovered = await recoverableWidgetProjection(projection, generation, now.getTime());
    return recovered.commands.get(actionKey) ?? null;
  } catch { return null; }
}
