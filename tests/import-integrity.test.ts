import { it, expect, vi } from "vitest";
import { LocalRepository } from "../lib/habits/repository";
import {
  importGuest,
  SupabaseTransport,
  type SyncResult,
  type PullResult,
} from "../lib/habits/sync";
import { entityKey, type Entity, type Habit } from "../lib/habits/domain";
async function fixture() {
  const guest = new LocalRepository(`guest:${crypto.randomUUID()}`, () => [], {
    getItem: () => null,
  });
  const member = new LocalRepository(`member:${crypto.randomUUID()}`);
  await guest.initialize();
  await member.initialize();
  const h: Habit = {
    id: crypto.randomUUID(),
    title: "keep source",
    icon: "🌱",
    timeGroup: "day",
    alarmEnabled: false,
    completed: false,
    rating: 0,
    memo: "",
  };
  await guest.create(h);
  const items = Object.values((await guest.state()).entities),
    rows = items.map((e) => ({ ...e, version: 1 }));
  const operation = {
    id: crypto.randomUUID(),
    changes: items.map((e) => ({ ...e, base: null })),
  };
  const conflict = {
    id: crypto.randomUUID(),
    operation,
    remote: rows.map((e) =>
      e.kind === "habits" ? { ...e, data: { ...e.data, title: "cloud" } } : e,
    ),
    resolved: false,
  };
  let result: SyncResult = { status: "conflict", conflict };
  const rpc = vi.fn(async (name: string): Promise<unknown> =>
    name === "begin_import"
      ? operation.id
      : name === "commit_import"
        ? result.status === "applied"
          ? { ...result, verified: true }
          : result
        : null,
  );
  const pull = vi.fn(async (): Promise<PullResult> => ({
    entities: rows,
    cursor: 1,
    conflicts: [],
  }));
  const cloud = { rpc, pull } as unknown as SupabaseTransport;
  return {
    guest,
    member,
    items,
    rows,
    rpc,
    pull,
    cloud,
    conflict,
    setResult: (r: SyncResult) => {
      result = r;
    },
    close: () => {
      guest.close();
      member.close();
    },
  };
}
it("conflict is not import success and retains its immutable journal and source", async () => {
  const f = await fixture();
  try {
    await importGuest(f.guest, f.member, f.cloud);
    const state = await f.member.state();
    expect(state.imported).toBeUndefined();
    expect(state.importJournal).toMatchObject({
      items: f.items,
      phase: "conflict",
    });
    expect(state.conflicts).toHaveLength(1);
    expect(Object.values((await f.guest.state()).entities)).toEqual(f.items);
  } finally {
    f.close();
  }
});
it("an applied result cannot complete import when independent server verification fails", async () => {
  const f = await fixture();
  try {
    f.setResult({ status: "applied", entities: f.rows, revision: 1 });
    f.pull.mockRejectedValueOnce(Error("network_unavailable"));
    await expect(importGuest(f.guest, f.member, f.cloud)).rejects.toThrow();
    expect((await f.member.state()).imported).toBeUndefined();
    expect((await f.member.state()).importJournal).toBeDefined();
  } finally {
    f.close();
  }
});
it("a mismatched record at the same server version fails verification without losing the journal", async () => {
  const f = await fixture();
  try {
    f.setResult({ status: "applied", entities: f.rows, revision: 1 });
    f.pull.mockResolvedValueOnce({
      entities: f.rows.map((e) =>
        e.kind === "habits" ? { ...e, data: { ...e.data, title: "wrong" } } : e,
      ),
      cursor: 1,
      conflicts: [],
    });
    await expect(importGuest(f.guest, f.member, f.cloud)).rejects.toThrow(
      "verification",
    );
    expect((await f.member.state()).imported).toBeUndefined();
  } finally {
    f.close();
  }
});
it("resolved import resumes the same batch and completes only after server/local equality", async () => {
  const f = await fixture();
  try {
    await importGuest(f.guest, f.member, f.cloud);
    const id = (await f.member.state()).importJournal?.id;
    expect(id).toBeDefined();
    f.setResult({ status: "applied", entities: f.rows, revision: 1 });
    f.pull.mockResolvedValue({
      entities: f.rows,
      cursor: 1,
      conflicts: [{ ...f.conflict, resolved: true }],
    });
    await importGuest(f.guest, f.member, f.cloud);
    const s = await f.member.state();
    expect(s.importJournal).toBeUndefined();
    expect(s.imported).toBeDefined();
    expect(s.importReceipt).toMatchObject({ batchId: id, cursor: 1 });
    expect(
      f.rpc.mock.calls.filter((c) => c[0] === "begin_import"),
    ).toHaveLength(1);
    for (const row of f.rows) expect(s.entities[row.key]).toEqual(row);
  } finally {
    f.close();
  }
});
it("session expiry during commit retains the batch and reports auth separately", async () => {
  const f = await fixture();
  try {
    f.rpc.mockImplementation(async (name: string) => {
      if (name === "begin_import") return f.conflict.operation.id;
      if (name === "commit_import") throw Error("auth_required");
      return null;
    });
    await expect(importGuest(f.guest, f.member, f.cloud)).rejects.toThrow(
      "auth_required",
    );
    expect((await f.member.state()).importJournal).toMatchObject({
      phase: "auth_required",
    });
    expect((await f.member.state()).imported).toBeUndefined();
  } finally {
    f.close();
  }
});

it("a lost commit response resumes the same immutable batch without starting a duplicate", async () => {
  const f = await fixture();
  let lose = true;
  try {
    f.rpc.mockImplementation(async (name: string) => {
      if (name === "begin_import") return f.conflict.operation.id;
      if (name === "commit_import") {
        if (lose) {
          lose = false;
          throw Error("network_unavailable");
        }
        return {
          status: "applied",
          entities: f.rows,
          revision: 1,
          verified: true,
        };
      }
      return null;
    });
    await expect(importGuest(f.guest, f.member, f.cloud)).rejects.toThrow(
      "network",
    );
    const journal = structuredClone((await f.member.state()).importJournal);
    expect(journal).toBeDefined();
    await importGuest(f.guest, f.member, f.cloud);
    expect(
      f.rpc.mock.calls.filter((c) => c[0] === "begin_import"),
    ).toHaveLength(1);
    expect((await f.member.state()).importReceipt?.batchId).toBe(journal!.id);
    expect(Object.values((await f.guest.state()).entities)).toEqual(f.items);
  } finally {
    f.close();
  }
});
it("account change while commit is in flight cannot mark either new account or old import successful", async () => {
  const f = await fixture(),
    other = new LocalRepository(`member:${crypto.randomUUID()}`);
  await other.initialize();
  let active = true;
  try {
    const before = await other.state();
    f.rpc.mockImplementation(async (name: string) => {
      if (name === "begin_import") return f.conflict.operation.id;
      if (name === "commit_import") {
        active = false;
        return {
          status: "applied",
          entities: f.rows,
          revision: 1,
          verified: true,
        };
      }
      return null;
    });
    await expect(
      importGuest(f.guest, f.member, f.cloud, () => active),
    ).rejects.toThrow("account_changed");
    expect((await f.member.state()).imported).toBeUndefined();
    expect((await f.member.state()).importJournal).toBeDefined();
    expect(await other.state()).toEqual(before);
  } finally {
    f.close();
    other.close();
  }
});
it("RPC identity is rechecked so a switched session never writes using another member repository", async () => {
  const uid = crypto.randomUUID();
  let current = uid;
  const calls: string[] = [];
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "fixture-token" } },
        error: null,
      }),
      getUser: async () => ({
        data: { user: { id: current, email_confirmed_at: "yes" } },
        error: null,
      }),
    },
    rpc: (name: string) => ({
      setHeader: () => {
        calls.push(name);
        return Promise.resolve({ data: "ok", error: null, status: 200 });
      },
    }),
  };
  const cloud = new SupabaseTransport(client as never, uid);
  await cloud.rpc("begin_import", {});
  current = crypto.randomUUID();
  await expect(cloud.rpc("stage_import", {})).rejects.toThrow("auth_required");
  expect(calls).toEqual(["begin_import"]);
});

it("pins the verified session token when the global Auth session switches before the RPC fetch", async () => {
  const uid = crypto.randomUUID();
  let pinned: string | undefined;
  let current = "fixture-A";
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: current } },
        error: null,
      }),
      getUser: async (token?: string) => {
        expect(token).toBe("fixture-A");
        current = "fixture-B";
        return {
          data: { user: { id: uid, email_confirmed_at: "yes" } },
          error: null,
        };
      },
    },
    rpc: () => ({
      setHeader: (_name: string, value: string) => {
        pinned = value;
        return Promise.resolve({ data: "ok", error: null, status: 200 });
      },
    }),
  };
  await expect(
    new SupabaseTransport(client as never, uid).rpc("apply_operation", {}),
  ).resolves.toBe("ok");
  expect(current).toBe("fixture-B");
  expect(pinned).toBe("Bearer fixture-A");
});

it("the real PostgREST builder preserves the pinned bearer even if SDK accessToken lookup sees the next session", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  let current = "fixture-A",
    sent: string | null = null;
  const uid = crypto.randomUUID();
  const client = createClient("http://localhost:54321", "public-fixture", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (_url, init) => {
        sent = new Headers(init?.headers).get("Authorization");
        return new Response(JSON.stringify("ok"), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  vi.spyOn(client.auth, "getSession").mockImplementation(async () => ({
    data: { session: { access_token: current } as never },
    error: null,
  }));
  vi.spyOn(client.auth, "getUser").mockImplementation(async (token) => {
    expect(token).toBe("fixture-A");
    current = "fixture-B";
    return {
      data: { user: { id: uid, email_confirmed_at: "yes" } as never },
      error: null,
    };
  });
  await expect(
    new SupabaseTransport(client, uid).rpc("apply_operation", {}),
  ).resolves.toBe("ok");
  expect(sent).toBe("Bearer fixture-A");
});
