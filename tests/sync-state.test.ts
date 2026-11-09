import { it, expect } from "vitest";
import { LocalRepository, type State } from "../lib/habits/repository";
import { SyncEngine, type CloudTransport } from "../lib/habits/sync";
type ObservedState = State & {
  sync?: { phase: string; lastSuccessAt?: string };
};
it("persists a server failure even when a cache refresh finds an empty outbox", async () => {
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  const cloud: CloudTransport = {
    apply: async () => {
      throw Error("not used");
    },
    pull: async () => {
      throw Error("server_error");
    },
  };
  try {
    await expect(new SyncEngine(r, cloud).run()).rejects.toThrow(
      "server_error",
    );
    const reloaded = (await r.load()).state as ObservedState;
    expect(reloaded.outbox).toEqual([]);
    expect(reloaded.sync?.phase).toBe("failed");
    expect(reloaded.sync?.lastSuccessAt).toBeUndefined();
  } finally {
    r.close();
  }
});
it("does not claim success when the first snapshot loads but the final pull fails", async () => {
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  let count = 0;
  const cloud: CloudTransport = {
    apply: async () => {
      throw Error("not used");
    },
    pull: async () => {
      if (count++) throw Error("server_error");
      return { entities: [], cursor: 0, conflicts: [] };
    },
  };
  try {
    await expect(new SyncEngine(r, cloud).run()).rejects.toThrow();
    const s = (await r.state()) as ObservedState;
    expect(s.hydrated).toBe(true);
    expect(s.sync?.phase).toBe("failed");
    expect(s.sync?.lastSuccessAt).toBeUndefined();
  } finally {
    r.close();
  }
});
it("keeps auth expiry distinct from network/server failure", async () => {
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  try {
    await expect(
      new SyncEngine(r, {
        apply: async () => {
          throw Error("unused");
        },
        pull: async () => {
          throw Error("auth_required");
        },
      }).run(),
    ).rejects.toThrow();
    expect(((await r.state()) as ObservedState).sync?.phase).toBe(
      "auth_required",
    );
  } finally {
    r.close();
  }
});

it("derives seven distinct states from persisted proof, not from empty outbox", async () => {
  const { syncStatus } = await import("../lib/habits/sync-status");
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  try {
    const s = await r.state();
    expect(syncStatus(false, s)).toBe("로컬 저장 완료");
    expect(syncStatus(true, s)).toBe("동기화 대기");
    s.hydrated = true;
    expect(syncStatus(true, s)).toBe("동기화 대기");
    s.sync = {
      phase: "succeeded",
      lastSuccessAt: "2026-01-01",
      lastSuccessLocalRevision: 0,
      lastSuccessCursor: 0,
    };
    expect(syncStatus(true, s)).toBe("클라우드 동기화 완료");
    s.localRevision = 1;
    expect(syncStatus(true, s)).toBe("동기화 대기");
    s.sync.phase = "failed";
    expect(syncStatus(true, s)).toBe("동기화 실패");
    s.sync.phase = "auth_required";
    expect(syncStatus(true, s)).toBe("인증 만료");
    s.sync.phase = "syncing";
    expect(syncStatus(true, s)).toBe("클라우드 동기화 중");
    s.conflicts = [
      {
        id: "c",
        resolved: false,
        operation: { id: "o", changes: [] },
        remote: [],
      },
    ];
    expect(syncStatus(true, s)).toBe("기록 충돌");
  } finally {
    r.close();
  }
});

it("stopping a prior account discards its in-flight snapshot and never updates another cache", async () => {
  const a = new LocalRepository(`member:${crypto.randomUUID()}`),
    b = new LocalRepository(`member:${crypto.randomUUID()}`);
  await a.initialize();
  await b.initialize();
  let release!: (value: {
    entities: never[];
    cursor: number;
    conflicts: never[];
  }) => void;
  const delayed = new Promise<{
    entities: never[];
    cursor: number;
    conflicts: never[];
  }>((resolve) => {
    release = resolve;
  });
  const engine = new SyncEngine(a, {
    apply: async () => {
      throw Error("unused");
    },
    pull: () => delayed,
  });
  try {
    const before = await b.state(),
      running = engine.run();
    await new Promise((resolve) => setTimeout(resolve, 10));
    engine.stop();
    release({ entities: [], cursor: 99, conflicts: [] });
    await running;
    expect((await a.state()).hydrated).not.toBe(true);
    expect((await a.state()).sync?.lastSuccessAt).toBeUndefined();
    expect(await b.state()).toEqual(before);
  } finally {
    a.close();
    b.close();
  }
});

it("a queued conflict choice is still unresolved until the server acknowledges it", async () => {
  const { acknowledge } = await import("../lib/habits/sync");
  const { entityKey } = await import("../lib/habits/domain");
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  const id = crypto.randomUUID(),
    key = entityKey("habits", id),
    data = {
      title: "local",
      icon: "x",
      timeGroup: "day",
      alarmEnabled: false,
      scheduledTime: null,
      position: 0,
    };
  const c = {
    id: crypto.randomUUID(),
    resolved: false,
    operation: {
      id: crypto.randomUUID(),
      changes: [
        {
          key,
          kind: "habits" as const,
          id,
          day: "",
          base: null,
          data,
          deleted: false,
        },
      ],
    },
    remote: [
      {
        key,
        kind: "habits" as const,
        id,
        day: "",
        data: { ...data, title: "remote" },
        version: 1,
        deleted: false,
      },
    ],
  };
  try {
    await r.mutate((s) => {
      s.conflicts = [c];
    });
    await r.resolve(c, false);
    await r.resolve(c, false);
    const s = await r.state();
    expect(s.conflicts[0].resolved).toBe(false);
    expect(s.outbox).toHaveLength(1);
    expect(s.entities[key].data.title).toBe("remote");
    acknowledge(s, s.outbox[0], {
      status: "applied",
      entities: [{ ...c.remote[0], version: 2 }],
      revision: 2,
    });
    expect(s.conflicts[0].resolved).toBe(true);
  } finally {
    r.close();
  }
});

it("preserves a queued choice as a fresh CAS conflict if another device already resolved the original", async () => {
  const { entityKey } = await import("../lib/habits/domain");
  const r = new LocalRepository(`member:${crypto.randomUUID()}`);
  await r.initialize();
  const id = crypto.randomUUID(),
    key = entityKey("habits", id),
    data = {
      title: "my choice",
      icon: "x",
      timeGroup: "day",
      scheduledTime: null,
      alarmEnabled: false,
      position: 0,
    };
  const remote = {
    key,
    kind: "habits" as const,
    id,
    day: "",
    data: { ...data, title: "old server" },
    deleted: false,
    version: 1,
  };
  const c = {
    id: crypto.randomUUID(),
    operation: {
      id: crypto.randomUUID(),
      changes: [{ ...remote, base: null, data }],
    },
    remote: [remote],
    resolved: false,
  };
  let newOpId = "";
  try {
    await r.mutate((s) => {
      s.conflicts = [c];
    });
    await r.resolve(c, true);
    const original = (await r.state()).outbox[0];
    const engine = new SyncEngine(r, {
      pull: async () => ({
        entities: [
          { ...remote, version: 2, data: { ...data, title: "other device" } },
        ],
        cursor: 2,
        conflicts: [{ ...c, resolved: true }],
      }),
      apply: async (op) => {
        if (op.conflictId) throw Error("conflict_already_resolved");
        newOpId = op.id;
        expect(op.changes[0].data.title).toBe("my choice");
        expect(op.changes[0].base?.version).toBe(1);
        return {
          status: "conflict",
          conflict: {
            id: "new-conflict",
            operation: op,
            remote: [
              {
                ...remote,
                version: 2,
                data: { ...data, title: "other device" },
              },
            ],
            resolved: false,
          },
        };
      },
    });
    await engine.run();
    const s = await r.state();
    expect(newOpId).not.toBe(original.id);
    expect(
      s.conflicts.find((x) => x.id === "new-conflict")?.operation.changes[0]
        .data.title,
    ).toBe("my choice");
    expect(s.conflicts.find((x) => x.id === c.id)?.resolved).toBe(true);
    expect(s.sync?.lastSuccessAt).toBeUndefined();
  } finally {
    r.close();
  }
});
