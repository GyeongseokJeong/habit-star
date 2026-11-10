import type { SyncMetadata } from "./sync-status";
import { openDB, type IDBPDatabase } from "idb";
import {
  type Change,
  type Entity,
  type Habit,
  type History,
  type Operation,
  type Conflict,
  dateKey,
  entityKey,
  definition,
  entry,
  view,
  same,
  isHabit,
  validDay,
} from "./domain";
import { captureLegacy, migrateLegacy, type Migration } from "./migration";
export type State = {
  entities: Record<string, Entity>;
  outbox: Operation[];
  conflicts: Conflict[];
  cursor: number;
  hydrated?: boolean;
  localRevision?: number;
  localSavedAt?: string;
  sync?: SyncMetadata;
  timezone: string;
  migration?: Migration;
  importLock?: { owner: string; until: number };
  imported?: string;
  hasUserEdits?: boolean;
  recoveryAcknowledged?: boolean;
  importReceipt?: {
    batchId: string;
    hash: string;
    cursor: number;
    verifiedAt: string;
  };
  importJournal?: {
    id: string;
    hash: string;
    items: Entity[];
    phase?: "staging" | "conflict" | "verifying" | "failed" | "auth_required";
    error?: string;
  };
};
export type Snapshot = {
  habits: Habit[];
  history: History;
  day: string;
  state: State;
};
export interface HabitRepository {
  load(): Promise<Snapshot>;
  ensureDay(): Promise<void>;
  update(id: string, patch: Partial<Habit>): Promise<void>;
  create(habit: Habit): Promise<void>;
  remove(id: string): Promise<void>;
  exportBackup(): Promise<string>;
}
const empty = (timezone: string): State => ({
  entities: {},
  outbox: [],
  conflicts: [],
  cursor: 0,
  timezone,
});
export class LocalRepository implements HabitRepository {
  private dbPromise: Promise<IDBPDatabase>;
  private channel: BroadcastChannel | null;
  private listeners = new Set<() => void>();
  constructor(
    readonly scope: string,
    private samples: () => Habit[] = () => [],
    private storage?: Pick<Storage, "getItem">,
    readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  ) {
    this.dbPromise = openDB("byeolharu-v2", 1, {
      upgrade(db) {
        db.createObjectStore("scopes");
        db.createObjectStore("backups");
      },
    });
    this.channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("byeolharu-v2")
        : null;
  }
  get member() {
    return this.scope.startsWith("member:");
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    const listener = (e: MessageEvent) => {
      if (e.data === this.scope) fn();
    };
    this.channel?.addEventListener("message", listener);
    return () => {
      this.listeners.delete(fn);
      this.channel?.removeEventListener("message", listener);
    };
  }
  close() {
    this.listeners.clear();
    this.channel?.close();
    void this.dbPromise.then((db) => db.close()).catch(() => {});
  }
  private notify() {
    for (const fn of this.listeners) fn();
    this.channel?.postMessage(this.scope);
  }
  async initialize() {
    const db = await this.dbPromise;
    if (await db.get("scopes", this.scope)) return;
    const state = empty(this.timezone);
    if (!this.member) {
      const backup = captureLegacy(this.storage ?? localStorage);
      // Persist raw bytes before parsing. This backup survives conversion failure.
      await db.put("backups", backup, backup.sourceId);
      state.migration = migrateLegacy(
        backup,
        dateKey(new Date()),
        this.samples(),
      );
      state.entities = Object.fromEntries(
        state.migration.entities.map((e) => [e.key, e]),
      );
    }
    const tx = db.transaction("scopes", "readwrite");
    if (!(await tx.store.get(this.scope)))
      await tx.store.put(state, this.scope);
    await tx.done;
    if (!this.member) await this.ensureDay();
  }
  async mutate(fn: (state: State) => void) {
    const db = await this.dbPromise,
      tx = db.transaction("scopes", "readwrite");
    try {
      const state = (await tx.store.get(this.scope)) as State | undefined;
      if (!state) throw Error("storage_unavailable");
      fn(state);
      await tx.store.put(state, this.scope);
      await tx.done;
    } catch (e) {
      try {
        tx.abort();
      } catch {}
      await tx.done.catch(() => {});
      throw e;
    }
    this.notify();
  }
  async state() {
    const s = (await (await this.dbPromise).get("scopes", this.scope)) as
      State | undefined;
    if (!s) throw Error("storage_unavailable");
    return s;
  }
  async load(): Promise<Snapshot> {
    const state = await this.state(),
      day = dateKey(new Date(), this.member ? state.timezone : undefined),
      entities = Object.values(state.entities),
      history: History = {};
    for (const e of entities)
      if (e.kind === "days" && !e.deleted)
        history[e.day] = view(entities, e.day);
    return { day, habits: view(entities, day), history, state };
  }
  private apply(s: State, changes: Change[], conflictId?: string) {
    if (!changes.length) return;
    if (!this.member && s.importLock && s.importLock.until > Date.now())
      throw Error("기록 이전 중에는 비회원 기록을 잠시 편집할 수 없어요.");
    if (changes.some((c) => !c.seed)) s.hasUserEdits = true;
    s.localRevision = (s.localRevision ?? 0) + 1;
    s.localSavedAt = new Date().toISOString();
    if (s.sync?.phase === "succeeded") s.sync = { ...s.sync, phase: "waiting" };
    for (const c of changes)
      s.entities[c.key] = {
        key: c.key,
        kind: c.kind,
        id: c.id,
        day: c.day,
        data: c.data,
        deleted: c.deleted,
        version: c.base?.version ?? 0,
      };
    if (this.member)
      s.outbox.push({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        changes,
        conflictId,
      });
  }
  async ensureDay() {
    await this.mutate((s) => {
      const day = dateKey(new Date(), this.member ? s.timezone : undefined),
        key = entityKey("days", day, day);
      if (s.entities[key]) return;
      const changes: Change[] = [
        {
          key,
          kind: "days",
          id: day,
          day,
          base: null,
          data: { timezone: s.timezone },
          deleted: false,
          seed: true,
        },
      ];
      for (const e of Object.values(s.entities).filter(
        (e) => e.kind === "habits" && !e.deleted,
      ))
        changes.push({
          key: entityKey("habit_entries", e.id, day),
          kind: "habit_entries",
          id: e.id,
          day,
          base: null,
          data: { ...e.data, completed: false, rating: 0, memo: "" },
          deleted: false,
          seed: true,
        });
      this.apply(s, changes);
    });
  }
  async create(h: Habit) {
    await this.mutate((s) => {
      const day = dateKey(new Date(), this.member ? s.timezone : undefined),
        position =
          Math.max(
            -1,
            ...Object.values(s.entities)
              .filter((e) => e.kind === "habits")
              .map((e) => Number(e.data.position)),
          ) + 1;
      this.apply(s, [
        {
          key: entityKey("habits", h.id),
          kind: "habits",
          id: h.id,
          day: "",
          base: null,
          data: definition(h, position),
          deleted: false,
        },
        {
          key: entityKey("habit_entries", h.id, day),
          kind: "habit_entries",
          id: h.id,
          day,
          base: null,
          data: entry(
            { ...h, completed: false, rating: 0, memo: "" },
            position,
          ),
          deleted: false,
        },
      ]);
    });
  }
  async update(id: string, patch: Partial<Habit>) {
    await this.edit(id, patch, false);
  }
  async remove(id: string) {
    await this.edit(id, {}, true);
  }
  private async edit(id: string, patch: Partial<Habit>, deleted: boolean) {
    await this.mutate((s) => {
      const day = dateKey(new Date(), this.member ? s.timezone : undefined),
        changes: Change[] = [];
      const definitionFields = [
        "title",
        "icon",
        "timeGroup",
        "scheduledTime",
        "repeatDays",
        "alarmEnabled",
      ];
      for (const kind of ["habits", "habit_entries"] as const) {
        const key = entityKey(kind, id, kind === "habits" ? "" : day),
          base = s.entities[key];
        if (!base || base.deleted) continue;
        const data = { ...base.data };
        for (const [k, v] of Object.entries(patch))
          if (
            k !== "id" &&
            (kind === "habit_entries" || definitionFields.includes(k))
          )
            data[k] = v ?? null;
        if ("scheduledTime" in patch)
          data.scheduledTime = patch.scheduledTime ?? null;
        if (deleted || !same(data, base.data))
          changes.push({
            key,
            kind,
            id,
            day: base.day,
            base: structuredClone(base),
            data,
            deleted,
          });
      }
      this.apply(s, changes);
    });
  }
  async changeHabits(update: (habits: Habit[]) => Habit[]) {
    await this.mutate((s) => {
      const day = dateKey(new Date(), this.member ? s.timezone : undefined),
        before = view(Object.values(s.entities), day),
        after = update(structuredClone(before));
      const changes: Change[] = [];
      let nextPosition =
        Math.max(
          -1,
          ...Object.values(s.entities)
            .filter((e) => e.kind === "habits")
            .map((e) => Number(e.data.position)),
        ) + 1;
      for (const [i, h] of after.entries()) {
        const prior = before.find((x) => x.id === h.id);
        if (
          (!prior || !same(prior, h)) &&
          s.conflicts.some(
            (c) =>
              !c.resolved && c.operation.changes.some((x) => x.id === h.id),
          )
        )
          throw Error("conflict");
        const old = before.find((x) => x.id === h.id);
        const insertionPosition = old ? i : nextPosition++;
        for (const kind of ["habits", "habit_entries"] as const) {
          if (
            kind === "habits" &&
            old &&
            same(definition(old, 0), definition(h, 0))
          )
            continue;
          const key = entityKey(kind, h.id, kind === "habits" ? "" : day),
            base = s.entities[key] ?? null;
          const position = base?.data.position ?? insertionPosition;
          const data =
            kind === "habits"
              ? definition(h, Number(position))
              : entry(h, Number(position));
          if (!old || !base || !same(base.data, data))
            changes.push({
              key,
              kind,
              id: h.id,
              day: kind === "habits" ? "" : day,
              base: base ? structuredClone(base) : null,
              data,
              deleted: false,
            });
        }
      }
      for (const old of before)
        if (!after.some((h) => h.id === old.id)) {
          if (
            s.conflicts.some(
              (c) =>
                !c.resolved && c.operation.changes.some((x) => x.id === old.id),
            )
          )
            throw Error("conflict");
        }
      for (const old of before)
        if (!after.some((h) => h.id === old.id))
          for (const kind of ["habits", "habit_entries"] as const) {
            const key = entityKey(kind, old.id, kind === "habits" ? "" : day),
              base = s.entities[key];
            if (base)
              changes.push({
                key,
                kind,
                id: old.id,
                day: base.day,
                base: structuredClone(base),
                data: base.data,
                deleted: true,
              });
          }
      this.apply(s, changes);
    });
  }
  async exportBackup() {
    const db = await this.dbPromise;
    return JSON.stringify(
      {
        format: "byeolharu-backup-v2",
        scope: this.scope,
        exportedAt: new Date().toISOString(),
        state: await this.state(),
        legacy: await db.getAll("backups"),
      },
      null,
      2,
    );
  }
  async acknowledgeRecovery() {
    await this.mutate((s) => {
      s.recoveryAcknowledged = true;
    });
  }
  async restoreBackup(content: string) {
    const parsed = JSON.parse(content);
    if (
      parsed.format !== "byeolharu-backup-v2" ||
      parsed.scope !== this.scope ||
      !parsed.state ||
      !parsed.state.entities
    )
      throw Error("같은 계정 또는 비회원 백업만 복원할 수 있어요.");
    const incoming = parsed.state as State;
    for (const e of Object.values(incoming.entities)) {
      if (
        !["habits", "habit_entries", "days"].includes(e.kind) ||
        e.key !== entityKey(e.kind, e.id, e.day) ||
        !e.data ||
        typeof e.deleted !== "boolean" ||
        !Number.isSafeInteger(e.version)
      )
        throw Error("잘못된 백업 형식입니다.");
    }
    if (
      !Array.isArray(incoming.outbox) ||
      !Array.isArray(incoming.conflicts) ||
      !Number.isSafeInteger(incoming.cursor) ||
      typeof incoming.timezone !== "string"
    )
      throw Error("잘못된 백업 형식입니다.");
    new Intl.DateTimeFormat("en", { timeZone: incoming.timezone }).format();
    for (const e of Object.values(incoming.entities)) {
      if (e.version < 0 || !Number.isInteger(e.data.position ?? 0))
        throw Error("잘못된 백업 형식입니다.");
      if (e.kind === "days") {
        if (!validDay(e.day) || e.id !== e.day)
          throw Error("잘못된 날짜입니다.");
        continue;
      }
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          e.id,
        ) ||
        (e.kind === "habit_entries" && !validDay(e.day)) ||
        (e.kind === "habits" && e.day !== "")
      )
        throw Error("잘못된 백업 식별자입니다.");
      const habit = {
        id: e.id,
        ...(e.kind === "habits"
          ? { completed: false, rating: 0, memo: "" }
          : {}),
        ...e.data,
        scheduledTime: e.data.scheduledTime ?? undefined,
      };
      if (!isHabit(habit)) throw Error("잘못된 습관 기록입니다.");
    }
    const validEntity = (value: unknown): value is Entity => {
      if (!value || typeof value !== "object") return false;
      const e = value as Entity;
      if (
        !["habits", "habit_entries", "days"].includes(e.kind) ||
        typeof e.id !== "string" ||
        typeof e.day !== "string" ||
        e.key !== entityKey(e.kind, e.id, e.day) ||
        !e.data ||
        typeof e.data !== "object" ||
        Array.isArray(e.data) ||
        typeof e.deleted !== "boolean" ||
        !Number.isSafeInteger(e.version) ||
        e.version < 0
      )
        return false;
      if (e.kind === "days") return validDay(e.day) && e.id === e.day;
      return (
        (e.kind === "habits" ? e.day === "" : validDay(e.day)) &&
        isHabit({
          id: e.id,
          ...(e.kind === "habits"
            ? { completed: false, rating: 0, memo: "" }
            : {}),
          ...e.data,
          scheduledTime: e.data.scheduledTime ?? undefined,
        })
      );
    };
    const validOperation = (value: unknown): value is Operation => {
      if (!value || typeof value !== "object") return false;
      const op = value as Operation;
      return (
        typeof op.id === "string" &&
        Array.isArray(op.changes) &&
        op.changes.length > 0 &&
        op.changes.every((c) => {
          if (!c || typeof c !== "object") return false;
          return (
            validEntity({ ...c, version: 0 }) &&
            (c.base === null || (validEntity(c.base) && c.base.key === c.key))
          );
        })
      );
    };
    if (
      Object.entries(incoming.entities).some(([key, e]) => key !== e.key) ||
      !incoming.outbox.every(validOperation) ||
      !incoming.conflicts.every(
        (c) =>
          c &&
          typeof c.id === "string" &&
          typeof c.resolved === "boolean" &&
          validOperation(c.operation) &&
          Array.isArray(c.remote) &&
          c.remote.every(validEntity),
      )
    )
      throw Error("잘못된 백업 명령 또는 충돌 형식입니다.");
    if (
      incoming.importJournal &&
      (!incoming.importJournal.id ||
        typeof incoming.importJournal.hash !== "string" ||
        !Array.isArray(incoming.importJournal.items) ||
        !incoming.importJournal.items.every(validEntity))
    )
      throw Error("잘못된 이전 백업 형식입니다.");
    // Existing data is never replaced by a restore. Use the empty account/device.
    await this.mutate((s) => {
      const meaningful = Object.values(s.entities).some(
        (e) => e.kind !== "days",
      );
      const freshGuest =
        !this.member &&
        s.migration &&
        [
          "byeolharu_v1_habits",
          "byeolharu_v1_history",
          "byeolharu_v1_day",
        ].every((k) => s.migration!.backup.raw[k] === null) &&
        !s.hasUserEdits;
      if ((meaningful && !freshGuest) || s.outbox.length)
        throw Error(
          "기록이 없는 같은 계정·새 브라우저에서 복원해주세요. 기존 기록은 덮어쓰지 않았습니다.",
        );
      Object.assign(s, structuredClone(incoming), { cursor: 0 });
      delete s.importLock;
      // A restored success receipt describes another cache/run, not this connection.
      s.sync = { phase: "waiting" };
    });
  }
  static async purgeScope(scope: string) {
    const db = await openDB("byeolharu-v2", 1);
    try {
      await db.delete("scopes", scope);
    } finally {
      db.close();
    }
  }
  async clear() {
    const db = await this.dbPromise;
    await db.delete("scopes", this.scope);
    this.notify();
  }
  async resolve(conflict: Conflict, useLocal: boolean) {
    await this.mutate((s) => {
      const found = s.conflicts.find((c) => c.id === conflict.id);
      if (
        !found ||
        found.resolved ||
        s.outbox.some((op) => op.conflictId === conflict.id)
      )
        return;
      const changes = conflict.operation.changes.map((c) => {
        const base = conflict.remote.find((r) => r.key === c.key) ?? null;
        return {
          ...c,
          seed: false,
          base,
          data: useLocal ? c.data : (base?.data ?? c.data),
          deleted: useLocal ? c.deleted : (base?.deleted ?? true),
        };
      });
      this.apply(s, changes, conflict.id);
      // Keep the conflict visible until the resolution operation is acknowledged.
    });
  }
}

/** The guest adapter never creates Auth identities or queues network writes. */
export class GuestRepository extends LocalRepository {
  constructor(
    samples: () => Habit[] = () => [],
    storage?: Pick<Storage, "getItem">,
  ) {
    super("guest", samples, storage);
  }
}
/** Member cache/Outbox identity is fixed for the lifetime of the adapter. */
export class MemberRepository extends LocalRepository {
  override async ensureDay() {
    if (!(await this.state()).hydrated) return;
    await super.ensureDay();
  }
  override async changeHabits(update: (habits: Habit[]) => Habit[]) {
    if (!(await this.state()).hydrated)
      throw Error("처음 로그인할 때는 한 번의 동기화가 필요해요.");
    await super.changeHabits(update);
  }
  constructor(userId: string) {
    if (!/^[0-9a-f-]{36}$/.test(userId)) throw Error("invalid_user_id");
    super(`member:${userId}`);
  }
}
