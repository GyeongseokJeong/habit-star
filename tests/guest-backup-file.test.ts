import { describe, it, expect } from "vitest";
import { guestBackupFilename, inspectGuestBackup } from "@/lib/habits/backup-file";

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
  it("generates safe filenames with a timestamp", () => {
    expect(guestBackupFilename(new Date("2026-11-21T02:15:32Z"))).toBe("byeolharu-backup-2026-11-21T02-15-32-000Z.json");
  });
});
