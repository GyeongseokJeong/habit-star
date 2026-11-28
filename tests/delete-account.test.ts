import { describe, expect, it, vi } from "vitest";
import { createDeleteAccountHandler } from "../supabase/functions/delete-account/handler";

const fixture = () => {
  const identify = vi.fn(async (token: string) => token === "valid" ? { id: "owner-a", email: "a@example.test", confirmed: true } : null);
  const verifyPassword = vi.fn(async (_email: string, password: string): Promise<string | null> => password === "correct" ? "owner-a" : null);
  const hardDelete = vi.fn(async (_id: string) => true);
  return { identify, verifyPassword, hardDelete, handler: createDeleteAccountHandler({ identify, verifyPassword, hardDelete }) };
};
function req(body: object, token = "valid") {
  return new Request("https://example.test/delete-account", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("self-service account deletion", () => {
  it("rejects non-POST and permits only non-mutating CORS preflight", async () => {
    const f = fixture();
    expect((await f.handler(new Request("https://example.test"))).status).toBe(405);
    expect((await f.handler(new Request("https://example.test", { method: "OPTIONS" }))).status).toBe(204);
    expect(f.hardDelete).not.toHaveBeenCalled();
  });
  it("rejects missing, invalid or unconfirmed authentication before checking the password", async () => {
    const f = fixture();
    expect((await f.handler(new Request("https://example.test", { method: "POST" }))).status).toBe(401);
    expect((await f.handler(req({ password: "correct", confirm: true }, "stale"))).status).toBe(401);
    f.identify.mockResolvedValueOnce({ id: "owner-a", email: "a@example.test", confirmed: false });
    expect((await f.handler(req({ password: "correct", confirm: true }))).status).toBe(401);
    expect(f.verifyPassword).not.toHaveBeenCalled();
    expect(f.hardDelete).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation, valid password and identical reauth identity", async () => {
    const f = fixture();
    expect((await f.handler(req({ password: "correct", confirm: false }))).status).toBe(400);
    expect((await f.handler(req({ password: "", confirm: true }))).status).toBe(400);
    expect((await f.handler(req({ password: "wrong", confirm: true }))).status).toBe(403);
    f.verifyPassword.mockResolvedValueOnce("owner-b");
    expect((await f.handler(req({ password: "correct", confirm: true }))).status).toBe(403);
    expect(f.hardDelete).not.toHaveBeenCalled();
  });
  it("ignores attacker-selected IDs and only deletes the authenticated member", async () => {
    const f = fixture();
    const response = await f.handler(req({ password: "correct", confirm: true, userId: "owner-b", email: "b@example.test" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: "deleted" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(f.verifyPassword).toHaveBeenCalledExactlyOnceWith("a@example.test", "correct");
    expect(f.hardDelete).toHaveBeenCalledExactlyOnceWith("owner-a");
  });
  it("does not report deletion if the administrator operation fails", async () => {
    const f = fixture();
    f.hardDelete.mockResolvedValueOnce(false);
    const response = await f.handler(req({ password: "correct", confirm: true }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "delete_failed" });
    f.verifyPassword.mockRejectedValueOnce(Error("private upstream details"));
    const failure = await f.handler(req({ password: "correct", confirm: true }));
    expect(await failure.json()).toEqual({ code: "delete_failed" });
  });
});

import { clearDeletedMemberLocalData, WRAPUP_REMINDER_STORAGE_PREFIX, REMINDER_LATENCY_STORAGE_PREFIX } from "../lib/habits/member-deletion-cache";

it("clears only the confirmed deleted member's known local preference keys", () => {
  const values = new Map<string, string>([
    ["byeolharu_verified_user", "owner-b"],
    [WRAPUP_REMINDER_STORAGE_PREFIX + "member:owner-a", "a"],
    [REMINDER_LATENCY_STORAGE_PREFIX + "member:owner-a", "a"],
    [WRAPUP_REMINDER_STORAGE_PREFIX + "member:owner-b", "b"],
    [WRAPUP_REMINDER_STORAGE_PREFIX + "guest", "guest"],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
  } as unknown as Storage;
  clearDeletedMemberLocalData(storage, "owner-a");
  expect([...values]).toEqual([
    ["byeolharu_verified_user", "owner-b"],
    [WRAPUP_REMINDER_STORAGE_PREFIX + "member:owner-b", "b"],
    [WRAPUP_REMINDER_STORAGE_PREFIX + "guest", "guest"],
  ]);
  clearDeletedMemberLocalData(storage, "owner-b");
  expect(values.has("byeolharu_verified_user")).toBe(false);
});
