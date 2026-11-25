import { LocalRepository } from "../../lib/habits/repository";
import { buildWidgetActionProjection, buildWidgetSummary, type WidgetSummary } from "../../lib/habits/widget-summary";
import { newWidgetCommandGeneration, recoverableWidgetProjection, recoverWidgetPracticeCommand } from "../../lib/habits/widget-command-recovery";
import { attachWidgetDetailKeys } from "../../lib/habits/widget-detail-navigation";
import { readWidgetCommandGeneration, writeWidgetCommandGeneration, widgetDetailSecret } from "./widget-command-generation";

const ORIGIN = "https://localhost";
const AUTH = "byeolharu_android_auth_v1";
const VERIFIED = "byeolharu_verified_user";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type StorageRead = Pick<Storage, "getItem">;
type Identity = { memberId: string | null; unchanged: () => boolean };
/** Offline local authority only, consistent with the app's previously verified
 * member cache. Never infer identity from a widget key, refresh a session,
 * copy tokens to native, or silently fall back to guest on corrupt auth.
 */
export function coldWidgetIdentity(storage: StorageRead, now = Date.now()): Identity | null {
  try {
    const raw = storage.getItem(AUTH), verified = storage.getItem(VERIFIED);
    const unchanged = () => {
      try { return storage.getItem(AUTH) === raw && storage.getItem(VERIFIED) === verified; }
      catch { return false; }
    };
    if (raw === null && verified === null) return { memberId: null, unchanged };
    if (raw === null || verified === null || !UUID.test(verified)) return null;
    const session = JSON.parse(raw);
    if (!session || session.user?.id !== verified || !session.user?.email_confirmed_at ||
        typeof session.expires_at !== "number" || !Number.isFinite(session.expires_at) ||
        session.expires_at * 1000 <= now + 10000 ||
        typeof session.access_token !== "string" || !session.access_token) return null;
    return { memberId: verified, unchanged: () => unchanged() && session.expires_at * 1000 > Date.now() };
  } catch { return null; }
}

export type ColdWidgetResult = { status: "saved" | "not-ready" | "stale" | "error"; summary?: WidgetSummary };
export async function runColdWidgetPractice(input: { origin: string; actionKey: string; deadline: number;
    storage: StorageRead; nativeAllowed: () => boolean }): Promise<ColdWidgetResult> {
  let repo: LocalRepository | undefined;
  let saved = false;
  try {
    const {origin,actionKey,deadline,storage,nativeAllowed} = input;
    if (origin !== ORIGIN || !UUID.test(actionKey) || !Number.isFinite(deadline) ||
        deadline <= Date.now() || deadline - Date.now() > 8000 || !nativeAllowed()) return {status:"not-ready"};
    const identity = coldWidgetIdentity(storage);
    if (!identity) return {status:"not-ready"};
    const allowed = () => Date.now() < deadline && identity.unchanged() && nativeAllowed();
    const generation = await readWidgetCommandGeneration(origin);
    if (!generation || !allowed()) return {status:"not-ready"};
    // No initialize(), ensureDay(), migration, or scope creation on widget taps.
    repo = new LocalRepository(identity.memberId ? "member:" + identity.memberId : "guest",
      () => [], undefined, Intl.DateTimeFormat().resolvedOptions().timeZone, true);
    const command = await recoverWidgetPracticeCommand(await repo.load(), identity.memberId, actionKey, generation);
    if (!command || !allowed()) return {status:"stale"};
    // Recheck the exact generation after asynchronous recovery, then use the
    // existing transaction's own synchronous guard/revision/version checks.
    const latest = await readWidgetCommandGeneration(origin);
    if (!latest || latest.nonce !== generation.nonce || latest.expiresAt !== generation.expiresAt || !allowed())
      return {status:"stale"};
    if (await repo.applyWidgetPractice(command, allowed) !== "saved") return {status:"stale"};
    saved = true;
    if (!allowed()) return {status:"saved"};
    const snapshot = await repo.load();
    if (!allowed()) return {status:"saved"};
    // Never synthesize a check state. Publish only the freshly committed snapshot.
    let display = buildWidgetSummary(snapshot, identity.memberId);
    if (!display) return {status:"saved"};
    const detailSecret = await widgetDetailSecret(origin);
    if (detailSecret) display = await attachWidgetDetailKeys(display,snapshot,identity.memberId,detailSecret);
    if (!allowed()) return {status:"saved"};
    try {
      const projection = buildWidgetActionProjection(snapshot, identity.memberId);
      if (!projection.summary || !projection.commands.size) return {status:"saved", summary:display};
      const next = newWidgetCommandGeneration(projection.summary);
      const recovered = await recoverableWidgetProjection(projection, next);
      if (!allowed()) return {status:"saved"};
      await writeWidgetCommandGeneration(origin,next);
      if (!allowed()) return {status:"saved"};
      const summary = recovered.summary ?? display;
      return {status:"saved",summary:detailSecret ? await attachWidgetDetailKeys(summary,snapshot,identity.memberId,detailSecret) : summary};
    } catch { return {status:"saved",summary:display}; }
  } catch { return {status:saved?"saved":"error"}; }
  finally { repo?.close(); }
}
