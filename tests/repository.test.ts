import { it, expect } from "vitest";
import { LocalRepository } from "../lib/habits/repository";
import {
  dateKey,
  entityKey,
  type Habit,
  type Entity,
  type Operation,
  applyHabitSettings,
  applyDailyRecord,
} from "../lib/habits/domain";
import {
  acknowledge,
  SyncEngine,
  type CloudTransport,
} from "../lib/habits/sync";
const sample = (): Habit => ({
  id: crypto.randomUUID(),
  title: "읽기",
  icon: "📚",
  timeGroup: "night",
  alarmEnabled: false,
  completed: false,
  rating: 0,
  memo: "",
});
const storage = { getItem: () => null };
async function guest() {
  const r = new LocalRepository(
    `guest:${crypto.randomUUID()}`,
    () => [],
    storage,
  );
  await r.initialize();
  return r;
}
it("transactions preserve concurrent edits, history and v1 bytes", async () => {
  const r = await guest(),
    h = sample();
  await r.create(h);
  await Promise.all([
    r.update(h.id, { memo: "기록" }),
    r.update(h.id, { rating: 4, completed: true }),
  ]);
  const s = await r.load();
  expect(s.habits[0]).toMatchObject({ memo: "기록", rating: 4 });
  await r.remove(h.id);
  expect((await r.load()).habits).toEqual([]);
  expect(
    (await r.state()).entities[entityKey("habit_entries", h.id, s.day)].deleted,
  ).toBe(true);
  expect(JSON.parse(await r.exportBackup()).legacy.length).toBeGreaterThan(0);
  r.close();
});
it("day creation is idempotent and clears only new practice fields", async () => {
  const r = await guest(),
    h = sample();
  await r.create(h);
  await r.update(h.id, { rating: 5, completed: true, memo: "keep" });
  const day = dateKey(new Date());
  await Promise.all([r.ensureDay(), r.ensureDay()]);
  expect((await r.load()).habits[0]).toMatchObject({ rating: 5, memo: "keep" });
  expect(
    Object.values((await r.state()).entities).filter(
      (e) => e.kind === "days" && e.day === day,
    ),
  ).toHaveLength(1);
  r.close();
});
it("keeps earlier practice untouched when today's repeat days change and queues both entities", async () => {
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  await r.ensureDay();
  await r.mutate((s) => {
    s.hydrated = true;
  });
  const h = sample();
  await r.create(h);
  const today = (await r.load()).day;
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  const pastKey = entityKey("habit_entries", h.id, yesterday);
  await r.mutate((s) => {
    s.entities[pastKey] = {
      ...structuredClone(s.entities[entityKey("habit_entries", h.id, today)]),
      key: pastKey,
      day: yesterday,
      data: {
        ...s.entities[entityKey("habit_entries", h.id, today)].data,
        completed: true,
        rating: 5,
        memo: "보존",
      },
    };
    s.entities[entityKey("days", yesterday, yesterday)] = {
      key: entityKey("days", yesterday, yesterday),
      kind: "days",
      id: yesterday,
      day: yesterday,
      data: { timezone: "UTC" },
      version: 0,
      deleted: false,
    };
  });
  const before = structuredClone((await r.state()).entities[pastKey]);
  await r.changeHabits((rows) =>
    rows.map((item) => ({ ...item, repeatDays: [0, 6] })),
  );
  const snapshot = await r.load();
  expect(snapshot.state.entities[pastKey]).toEqual(before);
  expect(snapshot.history[yesterday][0]).toMatchObject({
    memo: "보존",
    rating: 5,
  });
  expect(
    snapshot.state.entities[entityKey("habits", h.id)].data.repeatDays,
  ).toEqual([0, 6]);
  expect(
    snapshot.state.entities[entityKey("habit_entries", h.id, today)].data
      .repeatDays,
  ).toEqual([0, 6]);
  expect(snapshot.state.outbox.at(-1)?.changes.map((c) => c.kind)).toEqual([
    "habits",
    "habit_entries",
  ]);
  r.close();
});
it("persists configuration and daily record separately without changing past snapshots", async () => {
  const r = await guest();
  const h = sample();
  await r.create(h);
  const today = (await r.load()).day;
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  const pastKey = entityKey("habit_entries", h.id, yesterday);
  await r.mutate((s) => {
    s.entities[pastKey] = {
      ...structuredClone(s.entities[entityKey("habit_entries", h.id, today)]),
      key: pastKey,
      day: yesterday,
      data: {
        ...s.entities[entityKey("habit_entries", h.id, today)].data,
        rating: 5,
        completed: true,
        memo: "어제",
      },
    };
  });
  const pastBefore = structuredClone((await r.state()).entities[pastKey]);
  await r.changeHabits((rows) =>
    rows.map((item) =>
      applyDailyRecord(item, {
        rating: 0,
        completed: true,
        memo: "오늘",
      }),
    ),
  );
  await r.changeHabits((rows) =>
    rows.map((item) =>
      applyHabitSettings(item, {
        title: "새 이름",
        icon: "🌱",
        timeGroup: "morning",
        repeatDays: [1, 3],
        scheduledTime: "08:30",
        alarmEnabled: true,
      }),
    ),
  );
  let snapshot = await r.load();
  expect(snapshot.habits[0]).toMatchObject({
    title: "새 이름",
    rating: 0,
    completed: true,
    memo: "오늘",
  });
  expect(snapshot.state.entities[pastKey]).toEqual(pastBefore);
  await r.changeHabits((rows) =>
    rows.map((item) =>
      applyDailyRecord(item, {
        rating: 3,
        completed: true,
        memo: "수정한 오늘",
      }),
    ),
  );
  snapshot = await r.load();
  expect(snapshot.habits[0]).toMatchObject({
    title: "새 이름",
    icon: "🌱",
    scheduledTime: "08:30",
    alarmEnabled: true,
    rating: 3,
    memo: "수정한 오늘",
  });
  expect(snapshot.state.entities[pastKey]).toEqual(pastBefore);
  r.close();
});
it("aborts all writes when a transaction fails", async () => {
  const r = await guest(),
    before = await r.state();
  await expect(
    r.mutate((s) => {
      s.cursor = 99;
      throw Error("quota");
    }),
  ).rejects.toThrow("quota");
  expect(await r.state()).toEqual(before);
  r.close();
});
it("account namespaces do not share data", async () => {
  const a = new LocalRepository(`member:${crypto.randomUUID()}`),
    b = new LocalRepository(`member:${crypto.randomUUID()}`);
  await a.initialize();
  await b.initialize();
  await a.ensureDay();
  await a.create(sample());
  expect((await b.load()).habits).toEqual([]);
  await a.clear();
  await expect(a.state()).rejects.toThrow();
  a.close();
  b.close();
});
it("ack rebases later local edits without dropping a merged remote field", async () => {
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  await r.ensureDay();
  const h = sample();
  await r.create(h);
  await r.update(h.id, { memo: "next" });
  const s = await r.state(),
    create = s.outbox[1],
    rows = create.changes.map((c) => ({
      key: c.key,
      kind: c.kind,
      id: c.id,
      day: c.day,
      deleted: false,
      version: 2,
      data: { ...c.data, title: "remote title" },
    }));
  acknowledge(s, create, { status: "applied", entities: rows, revision: 2 });
  expect(
    s.outbox.at(-1)?.changes.find((c) => c.kind === "habit_entries")?.data,
  ).toMatchObject({ memo: "next", title: "remote title" });
  r.close();
});
it("retry uses the same operation ID after a lost response", async () => {
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  await r.ensureDay();
  const seen: string[] = [];
  let fail = true;
  const cloud: CloudTransport = {
    pull: async () => ({ entities: [], cursor: 0, conflicts: [] }),
    apply: async (op) => {
      seen.push(op.id);
      if (fail) {
        fail = false;
        throw Error("lost");
      }
      return {
        status: "applied",
        entities: op.changes.map((c) => ({ ...c, version: 1 }) as Entity),
        revision: 1,
      };
    },
  };
  const e = new SyncEngine(r, cloud);
  await expect(e.run()).rejects.toThrow("lost");
  await e.run();
  expect(seen).toHaveLength(2);
  expect(seen[0]).toBe(seen[1]);
  expect((await r.state()).outbox).toEqual([]);
  r.close();
});

it("restore rejects a different account and never overwrites existing work", async () => {
  const a = await guest(),
    b = await guest();
  await a.create(sample());
  const content = await a.exportBackup();
  await expect(b.restoreBackup(content)).rejects.toThrow("같은 계정");
  await expect(a.restoreBackup(content)).rejects.toThrow("덮어쓰지");
  expect((await a.load()).habits).toHaveLength(1);
  a.close();
  b.close();
});

it("import lease prevents a second tab from editing the frozen source", async () => {
  const r = await guest(),
    h = sample();
  await r.create(h);
  await r.mutate((s) => {
    s.importLock = { owner: "test", until: Date.now() + 60000 };
  });
  await expect(r.update(h.id, { memo: "unsafe" })).rejects.toThrow("이전 중");
  expect((await r.load()).habits[0].memo).toBe("");
  await r.mutate((s) => {
    delete s.importLock;
  });
  await r.update(h.id, { memo: "safe" });
  expect((await r.load()).habits[0].memo).toBe("safe");
  r.close();
});

it("a first-login outage cannot freeze an empty day before the cloud snapshot arrives", async () => {
  const { MemberRepository } = await import("../lib/habits/repository");
  const r = new MemberRepository(crypto.randomUUID());
  await r.initialize();
  await r.ensureDay();
  expect(Object.values((await r.state()).entities)).toEqual([]);
  await expect(r.changeHabits(() => [sample()])).rejects.toThrow(
    "한 번의 동기화",
  );
  const engine = new SyncEngine(r, {
    pull: async () => ({ entities: [], cursor: 0, conflicts: [] }),
    apply: async () => {
      throw Error("not needed");
    },
  });
  await engine.run();
  await r.ensureDay();
  expect((await r.state()).outbox).toHaveLength(1);
  r.close();
});

it("appends a new habit after deletion without reusing a surviving sort position", async () => {
  const r = await guest(),
    first = sample(),
    second = sample(),
    third = sample(),
    added = sample();
  try {
    await r.changeHabits(() => [first, second, third]);
    await r.changeHabits((rows) => rows.filter((h) => h.id !== first.id));
    await r.changeHabits((rows) => [...rows, added]);
    const snapshot = await r.load();
    const positions = snapshot.habits.map(
      (h) =>
        snapshot.state.entities[entityKey("habit_entries", h.id, snapshot.day)]
          .data.position,
    );
    expect(positions).toEqual([1, 2, 3]);
    expect(snapshot.habits.map((h) => h.id)).toEqual([
      second.id,
      third.id,
      added.id,
    ]);
  } finally {
    r.close();
  }
});

it("rejects malformed backup commands before replacing the local state", async () => {
  const r = await guest();
  try {
    const before = await r.state(),
      backup = JSON.parse(await r.exportBackup());
    backup.state.outbox = [{ id: crypto.randomUUID(), changes: null }];
    await expect(r.restoreBackup(JSON.stringify(backup))).rejects.toThrow();
    expect(await r.state()).toEqual(before);
  } finally {
    r.close();
  }
});
