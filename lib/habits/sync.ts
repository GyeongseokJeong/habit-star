import { errorCode, failurePhase } from "./sync-status";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LocalRepository, type State } from "./repository";
import { type Entity, type Operation, type Conflict, same } from "./domain";
export type SyncResult =
  | { status: "applied"; entities: Entity[]; revision: number }
  | { status: "conflict"; conflict: Conflict };
export type PullResult = {
  entities: Entity[];
  cursor: number;
  conflicts: Conflict[];
};
export interface CloudTransport {
  prepare?(): Promise<string>;
  apply(op: Operation): Promise<SyncResult>;
  pull(cursor: number): Promise<PullResult>;
}
export class SupabaseTransport implements CloudTransport {
  constructor(
    private client: SupabaseClient,
    private userId: string,
  ) {}
  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const {
      data: { session },
      error: sessionError,
    } = await this.client.auth.getSession();
    if (sessionError || !session) throw Error("auth_required");
    // Verify this exact token, then pin it on the RPC. The global session can change
    // between awaits (another tab/login); it must never redirect A's command to B.
    const {
      data: { user },
      error: authError,
    } = await this.client.auth.getUser(session.access_token);
    if (
      authError &&
      (authError.status === 0 ||
        (authError.name === "AuthRetryableFetchError" && !authError.status))
    )
      throw Error("network_unavailable");
    if (authError?.status && authError.status >= 500)
      throw Error("sync_server_error");
    if (authError || user?.id !== this.userId || !user.email_confirmed_at)
      throw Error("auth_required");
    const { data, error, status } = await this.client
      .rpc(name, args)
      .setHeader("Authorization", `Bearer ${session.access_token}`);
    if (error)
      throw Error(
        status === 401 || error.message.includes("auth_required")
          ? "auth_required"
          : error.message,
      );
    return data as T;
  }
  prepare() {
    return this.rpc<string>("initialize_profile", {
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }
  apply(op: Operation) {
    return this.rpc<SyncResult>("apply_operation", { p_operation: op });
  }
  async pull(cursor: number): Promise<PullResult> {
    type Page = PullResult & {
      snapshot: string | null;
      next_offset: number | null;
    };
    let page = await this.rpc<Page>("pull_changes", { p_cursor: cursor }),
      entities = [...page.entities];
    while (page.next_offset !== null) {
      page = await this.rpc<Page>("pull_changes", {
        p_cursor: cursor,
        p_snapshot: page.snapshot,
        p_offset: page.next_offset,
      });
      entities.push(...page.entities);
    }
    return { entities, cursor: page.cursor, conflicts: page.conflicts };
  }
}
export function reconcileConflicts(state: State, incoming: Conflict[]) {
  const all = new Map(state.conflicts.map((c) => [c.id, c]));
  for (const c of incoming) all.set(c.id, c);
  state.conflicts = [...all.values()];
}
export function overlay(state: State, rows: Entity[]) {
  for (const row of rows) {
    const prior = state.entities[row.key];
    if (!prior || row.version >= prior.version) state.entities[row.key] = row;
  }
  for (const op of state.outbox)
    for (const c of op.changes) {
      const remote = state.entities[c.key],
        data = { ...remote?.data, ...c.data };
      // Keep remote unrelated fields while projecting only the user's changes.
      if (c.base && remote) {
        for (const k of Object.keys(c.base.data))
          if (same(c.base.data[k], c.data[k])) data[k] = remote.data[k];
      }
      state.entities[c.key] = {
        key: c.key,
        kind: c.kind,
        id: c.id,
        day: c.day,
        data,
        version: remote?.version ?? 0,
        deleted: c.deleted,
      };
    }
  for (const conflict of state.conflicts.filter(
    (c) => !c.resolved && !state.outbox.some((op) => op.conflictId === c.id),
  ))
    for (const c of conflict.operation.changes)
      state.entities[c.key] = {
        key: c.key,
        kind: c.kind,
        id: c.id,
        day: c.day,
        data: c.data,
        deleted: c.deleted,
        version: c.base?.version ?? 0,
      };
}
export function acknowledge(state: State, op: Operation, result: SyncResult) {
  state.outbox = state.outbox.filter((o) => o.id !== op.id);
  if (op.conflictId) {
    const resolved = state.conflicts.find((c) => c.id === op.conflictId);
    if (resolved) resolved.resolved = true;
  }
  if (result.status === "conflict") {
    if (!state.conflicts.some((c) => c.id === result.conflict.id))
      state.conflicts.push(result.conflict);
    // Later edits touching a conflict stay durable but must not bypass its resolution.
    overlay(state, result.conflict.remote);
    return;
  }
  const current = new Map(result.entities.map((e) => [e.key, e]));
  for (const pending of state.outbox)
    for (const c of pending.changes) {
      const row = current.get(c.key);
      if (!row) continue;
      const data = { ...row.data };
      for (const k of Object.keys(c.data))
        if (!c.base || !same(c.base.data[k], c.data[k])) data[k] = c.data[k];
      c.base = structuredClone(row);
      c.data = data;
      current.set(c.key, { ...row, data, deleted: c.deleted });
    }
  overlay(state, result.entities);
}
export class SyncEngine {
  private stopped = false;
  constructor(
    private repo: LocalRepository,
    private cloud: CloudTransport,
  ) {}
  stop() {
    this.stopped = true;
  }
  async run() {
    const attemptId = crypto.randomUUID();
    const work = async () => {
      if (this.stopped) return;
      await this.repo.mutate((s) => {
        s.sync = {
          ...s.sync,
          phase: "syncing",
          attemptId,
          lastAttemptAt: new Date().toISOString(),
          error: undefined,
        };
      });
      try {
        // Pull before sending, but preserve original operation bases for CAS.
        if (this.cloud.prepare) {
          const timezone = await this.cloud.prepare();
          if (this.stopped) return;
          await this.repo.mutate((s) => {
            s.timezone = timezone;
          });
        }
        const state = await this.repo.state(),
          pulled = await this.cloud.pull(
            state.cursor === 0 ? -1 : state.cursor,
          );
        if (this.stopped) return;
        await this.repo.mutate((s) => {
          s.hydrated = true;
          reconcileConflicts(s, pulled.conflicts);
          overlay(s, pulled.entities);
          s.cursor = Math.max(s.cursor, pulled.cursor);
        });
        for (let i = 0; i < 100 && !this.stopped; i++) {
          const s = await this.repo.state();
          const blocked = new Set(
            s.conflicts
              .filter((c) => !c.resolved)
              .flatMap((c) => c.operation.changes.map((x) => x.key)),
          );
          const op = s.outbox.find(
            (o) => o.conflictId || !o.changes.some((c) => blocked.has(c.key)),
          );
          if (!op) break;
          let result: SyncResult;
          try {
            result = await this.cloud.apply(op);
          } catch (error) {
            if (
              !op.conflictId ||
              errorCode(error) !== "conflict_already_resolved"
            )
              throw error;
            // Preserve this device's choice if another device already resolved it.
            const snapshot = await this.cloud.pull(-1);
            if (this.stopped) return;
            if (
              !snapshot.conflicts.some(
                (c) => c.id === op.conflictId && c.resolved,
              )
            )
              throw error;
            await this.repo.mutate((s) => {
              const index = s.outbox.findIndex((o) => o.id === op.id);
              if (index < 0) return;
              const { conflictId, ...original } = s.outbox[index];
              s.outbox[index] = {
                ...original,
                id: crypto.randomUUID(),
                supersedesOperationId: op.id,
              };
              reconcileConflicts(s, snapshot.conflicts);
              overlay(s, snapshot.entities);
              s.cursor = Math.max(s.cursor, snapshot.cursor);
            });
            continue;
          }
          if (this.stopped) return;
          await this.repo.mutate((s) => acknowledge(s, op, result));
        }
        const latest = await this.repo.state(),
          delta = await this.cloud.pull(latest.cursor);
        if (this.stopped) return;
        await this.repo.mutate((s) => {
          reconcileConflicts(s, delta.conflicts);
          overlay(s, delta.entities);
          s.cursor = Math.max(s.cursor, delta.cursor);
          if (s.sync?.attemptId === attemptId) {
            const pending =
              s.outbox.length > 0 ||
              s.conflicts.some((c) => !c.resolved) ||
              !!s.importJournal;
            s.sync = {
              ...s.sync,
              phase: pending ? "waiting" : "succeeded",
              error: undefined,
              ...(!pending
                ? {
                    lastSuccessAt: new Date().toISOString(),
                    lastSuccessLocalRevision: s.localRevision ?? 0,
                    lastSuccessCursor: s.cursor,
                  }
                : {}),
            };
          }
        });
        return { status: "completed" as const };
      } catch (error) {
        if (!this.stopped)
          await this.repo.mutate((s) => {
            if (s.sync?.attemptId === attemptId)
              s.sync = {
                ...s.sync,
                phase: failurePhase(error),
                error: errorCode(error),
              };
          });
        throw error;
      }
    };
    if (typeof navigator !== "undefined" && navigator.locks)
      return navigator.locks.request(
        `sync:${this.repo.scope}`,
        { ifAvailable: true },
        (lock) => (lock ? work() : { status: "skipped" as const }),
      );
    // Server idempotency protects duplicate workers on older browsers.
    return work();
  }
}
export type ImportOutcome =
  { status: "applied" } | { status: "conflict"; conflict: Conflict };
export type ImportTransport = Pick<SupabaseTransport, "rpc" | "pull">;
export async function importGuest(
  guest: LocalRepository,
  member: LocalRepository,
  cloud: ImportTransport,
  active: () => boolean = () => true,
): Promise<ImportOutcome> {
  const run = () => performImport(guest, member, cloud, active);
  // Import verification and the normal sync loop share the same account lock.
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(`sync:${member.scope}`, run);
  return run();
}
async function performImport(
  guest: LocalRepository,
  member: LocalRepository,
  cloud: ImportTransport,
  active: () => boolean = () => true,
): Promise<ImportOutcome> {
  const assertActive = () => {
    if (!active()) throw Error("account_changed");
  };
  const owner = crypto.randomUUID();
  assertActive();
  await guest.mutate((s) => {
    if (s.importLock && s.importLock.until > Date.now())
      throw Error("다른 창에서 기록을 이전하고 있어요.");
    s.importLock = { owner, until: Date.now() + 60000 };
  });
  try {
    return await importGuestUnlocked(guest, member, cloud, assertActive, owner);
  } catch (error) {
    if (active())
      await member.mutate((s) => {
        if (s.importJournal) {
          s.importJournal.phase =
            failurePhase(error) === "auth_required"
              ? "auth_required"
              : "failed";
          s.importJournal.error = errorCode(error);
          s.sync = {
            ...s.sync,
            phase: failurePhase(error),
            error: errorCode(error),
          };
        }
      });
    throw error;
  } finally {
    await guest.mutate((s) => {
      if (s.importLock?.owner === owner) delete s.importLock;
    });
  }
}
async function importGuestUnlocked(
  guest: LocalRepository,
  member: LocalRepository,
  cloud: ImportTransport,
  assertActive: () => void,
  owner: string,
): Promise<ImportOutcome> {
  const source = await guest.state();
  assertActive();
  if (source.migration?.issues.length && !source.recoveryAcknowledged)
    throw Error("복구 항목을 먼저 백업·확인해주세요.");
  let journal = (await member.state()).importJournal;
  if (!journal) {
    const items = Object.values(source.entities).filter(
      (e) => e.kind !== "days" || !e.deleted,
    );
    const hash = await sha256(JSON.stringify(items));
    assertActive();
    const id = await cloud.rpc<string>("begin_import", {
      p_source: source.migration?.backup.sourceId ?? guest.scope,
      p_hash: hash,
      p_total: items.length,
    });
    assertActive();
    journal = { id, hash, items, phase: "staging" };
    await member.mutate((s) => {
      s.importJournal = journal;
    });
  }
  const frozen = journal;
  assertActive();
  await member.mutate((s) => {
    if (s.importJournal) {
      s.importJournal.phase = "staging";
      delete s.importJournal.error;
    }
  });
  for (let i = 0; i < frozen.items.length; i += 200) {
    assertActive();
    await guest.mutate((s) => {
      if (s.importLock?.owner !== owner || s.importLock.until <= Date.now())
        throw Error("import_lease_lost");
      s.importLock.until = Date.now() + 60000;
    });
    await cloud.rpc("stage_import", {
      p_batch: frozen.id,
      p_chunk: i / 200,
      p_items: frozen.items.slice(i, i + 200),
    });
  }
  assertActive();
  const result = await cloud.rpc<SyncResult & { verified?: boolean }>(
    "commit_import",
    { p_batch: frozen.id, p_content: JSON.stringify(frozen.items) },
  );
  assertActive();
  if (result.status === "conflict") {
    await member.mutate((s) => {
      if (!s.conflicts.some((c) => c.id === result.conflict.id))
        s.conflicts.push(result.conflict);
      if (s.importJournal) s.importJournal.phase = "conflict";
      // Legacy clients could have marked this same hash successful before verification.
      if (s.imported === frozen.hash && !s.importReceipt) delete s.imported;
      overlay(s, result.conflict.remote);
    });
    return result;
  }
  if (result.status !== "applied" || result.verified !== true)
    throw Error("import_verification_failed");
  await member.mutate((s) => {
    if (s.importJournal) s.importJournal.phase = "verifying";
  });
  const snapshot = await cloud.pull(-1);
  assertActive();
  const rows = new Map(snapshot.entities.map((e) => [e.key, e]));
  if (
    snapshot.cursor < result.revision ||
    result.entities.length !== frozen.items.length
  )
    throw Error("import_verification_failed");
  const sourceKeys = new Set(frozen.items.map((e) => e.key));
  if (
    new Set(result.entities.map((e) => e.key)).size !== frozen.items.length ||
    result.entities.some((e) => !sourceKeys.has(e.key))
  )
    throw Error("import_verification_failed");
  for (const expected of result.entities) {
    const actual = rows.get(expected.key);
    if (
      !actual ||
      actual.version < expected.version ||
      (actual.version === expected.version &&
        (!same(actual.data, expected.data) ||
          actual.deleted !== expected.deleted))
    )
      throw Error("import_verification_failed");
  }
  await member.mutate((s) => {
    // No async work inside this transaction: equality and success are committed atomically.
    const importedKeys = new Set(frozen.items.map((e) => e.key));
    reconcileConflicts(s, snapshot.conflicts);
    if (
      s.outbox.some((op) => op.changes.some((c) => importedKeys.has(c.key))) ||
      s.conflicts.some(
        (c) =>
          !c.resolved &&
          c.operation.changes.some((x) => importedKeys.has(x.key)),
      )
    )
      throw Error("import_verification_pending");
    overlay(s, snapshot.entities);
    for (const expected of result.entities) {
      const actual = rows.get(expected.key)!;
      if (!same(s.entities[actual.key], actual))
        throw Error("import_verification_failed");
    }
    s.cursor = Math.max(s.cursor, snapshot.cursor);
    s.hydrated = true;
    s.imported = frozen.hash;
    s.importReceipt = {
      batchId: frozen.id,
      hash: frozen.hash,
      cursor: snapshot.cursor,
      verifiedAt: new Date().toISOString(),
    };
    delete s.importJournal;
    s.localRevision = (s.localRevision ?? 0) + 1;
    const pending = s.outbox.length || s.conflicts.some((c) => !c.resolved);
    s.sync = {
      ...s.sync,
      phase: pending ? "waiting" : "succeeded",
      ...(!pending
        ? {
            lastSuccessAt: new Date().toISOString(),
            lastSuccessLocalRevision: s.localRevision,
            lastSuccessCursor: s.cursor,
          }
        : {}),
    };
  });
  return { status: "applied" };
}
export async function sha256(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
