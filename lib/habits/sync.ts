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
      data: { user },
      error: authError,
    } = await this.client.auth.getUser();
    if (authError || user?.id !== this.userId || !user.email_confirmed_at)
      throw Error("auth_required");
    const { data, error } = await this.client.rpc(name, args);
    if (error)
      throw Error(error.code === "42501" ? "auth_required" : error.message);
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
export function overlay(state: State, rows: Entity[]) {
  for (const row of rows) state.entities[row.key] = row;
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
  for (const conflict of state.conflicts.filter((c) => !c.resolved))
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
    const work = async () => {
      if (this.stopped) return;
      // Pull before sending, but preserve original operation bases for CAS.
      if (this.cloud.prepare) {
        const timezone = await this.cloud.prepare();
        if (this.stopped) return;
        await this.repo.mutate((s) => {
          s.timezone = timezone;
        });
      }
      const state = await this.repo.state(),
        pulled = await this.cloud.pull(state.cursor === 0 ? -1 : state.cursor);
      if (this.stopped) return;
      await this.repo.mutate((s) => {
        s.hydrated = true;
        s.conflicts = pulled.conflicts;
        overlay(s, pulled.entities);
        s.cursor = pulled.cursor;
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
        const result = await this.cloud.apply(op);
        if (this.stopped) return;
        await this.repo.mutate((s) => acknowledge(s, op, result));
      }
      const latest = await this.repo.state(),
        delta = await this.cloud.pull(latest.cursor);
      if (this.stopped) return;
      await this.repo.mutate((s) => {
        s.conflicts = delta.conflicts;
        overlay(s, delta.entities);
        s.cursor = delta.cursor;
      });
    };
    if (typeof navigator !== "undefined" && navigator.locks)
      return navigator.locks.request(
        `sync:${this.repo.scope}`,
        { ifAvailable: true },
        (lock) => (lock ? work() : undefined),
      );
    // Server idempotency protects duplicate workers on older browsers.
    return work();
  }
}
export async function importGuest(
  guest: LocalRepository,
  member: LocalRepository,
  cloud: SupabaseTransport,
) {
  const owner = crypto.randomUUID();
  await guest.mutate((s) => {
    if (s.importLock && s.importLock.until > Date.now())
      throw Error("다른 창에서 기록을 이전하고 있어요.");
    s.importLock = { owner, until: Date.now() + 60000 };
  });
  try {
    return await importGuestUnlocked(guest, member, cloud);
  } finally {
    await guest.mutate((s) => {
      if (s.importLock?.owner === owner) delete s.importLock;
    });
  }
}
async function importGuestUnlocked(
  guest: LocalRepository,
  member: LocalRepository,
  cloud: SupabaseTransport,
) {
  const s = await guest.state();
  if (s.migration?.issues.length && !s.recoveryAcknowledged)
    throw Error("복구 항목을 먼저 백업·확인해주세요.");
  let journal = (await member.state()).importJournal;
  if (!journal) {
    const items = Object.values(s.entities).filter(
      (e) => e.kind !== "days" || !e.deleted,
    );
    // Keep frozen bytes to resume an interrupted import, including after reload.
    const content = JSON.stringify(items),
      hash = await sha256(content);
    const id = await cloud.rpc<string>("begin_import", {
      p_source: s.migration?.backup.sourceId ?? guest.scope,
      p_hash: hash,
      p_total: items.length,
    });
    journal = { id, hash, items };
    await member.mutate((s) => {
      s.importJournal = journal;
    });
  }
  for (let i = 0; i < journal.items.length; i += 200) {
    await guest.mutate((s) => {
      if (s.importLock) s.importLock.until = Date.now() + 60000;
    });
    await cloud.rpc("stage_import", {
      p_batch: journal.id,
      p_chunk: i / 200,
      p_items: journal.items.slice(i, i + 200),
    });
  }
  if (!journal.items.length) {
    await member.mutate((s) => {
      s.imported = journal!.hash;
      delete s.importJournal;
    });
    return;
  }
  const result = await cloud.rpc<SyncResult>("commit_import", {
    p_batch: journal.id,
    p_content: JSON.stringify(journal.items),
  });
  await member.mutate((s) => {
    if (result.status === "conflict") s.conflicts.push(result.conflict);
    else overlay(s, result.entities);
    s.imported = journal!.hash;
    delete s.importJournal;
  });
}
export async function sha256(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
