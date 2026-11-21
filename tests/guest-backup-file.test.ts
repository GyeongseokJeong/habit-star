import { describe, it, expect } from "vitest";
import { guestBackupFilename, memberBackupFilename, inspectGuestBackup, inspectPortableBackup } from "../lib/habits/backup-file";

const backup = (scope = "guest") => JSON.stringify({
  format: "byeolharu-backup-v2",
  scope,
  state: { entities: {
    a: { kind: "habits", deleted: false },
    b: { kind: "habit_entries", deleted: false },
    c: { kind: "habit_entries", deleted: true },
    d: { kind: "days", deleted: false },
  } },
});

describe("portable Android guest backups", () => {
  it("accepts v2 guest metadata without reading live user storage", () => {
    expect(inspectGuestBackup(backup())).toEqual({ habitCount: 1, entryCount: 1 });
  });
  it("refuses member, legacy, malformed and structurally incomplete data", () => {
    expect(() => inspectGuestBackup(backup("member:user"))).toThrow("비회원");
    expect(() => inspectGuestBackup(JSON.stringify({format: "byeolharu-backup-v1",scope: "guest"}))).toThrow();
    expect(() => inspectGuestBackup("{invalid")).toThrow("JSON");
    expect(() => inspectGuestBackup(JSON.stringify({format: "byeolharu-backup-v2",scope: "guest"}))).toThrow();
  });
  it("supports account-scoped member backups but refuses other account restores", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    expect(inspectPortableBackup(backup("member:" + userId), "member:" + userId))
      .toMatchObject({ scope: "member:" + userId, habitCount: 1, entryCount: 1 });
    expect(() => inspectPortableBackup(backup("member:" + userId), "guest")).toThrow("현재 로그인한 계정");
    expect(() => inspectPortableBackup(backup("member:" + userId), "member:other-user")).toThrow();
    expect(() => inspectGuestBackup(backup("member:" + userId))).toThrow("비회원");
    expect(() => inspectPortableBackup(backup("member:../oops"))).toThrow();
  });
  it("generates safe filenames with a timestamp", () => {
    expect(guestBackupFilename(new Date("2026-11-21T02:15:32Z"))).toBe("byeolharu-backup-2026-11-21T02-15-32-000Z.json");
    expect(memberBackupFilename(new Date("2026-11-21T02:15:32Z"))).toBe("byeolharu-member-backup-2026-11-21T02-15-32-000Z.json");
  });
});
