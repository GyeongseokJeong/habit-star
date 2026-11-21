/**
 * Checks a portable, unencrypted Byeolharu guest backup before Android export
 * or import. Full entity validation remains in LocalRepository.restoreBackup.
 */
export const MAX_GUEST_BACKUP_BYTES = 25 * 1024 * 1024;

export function inspectGuestBackup(content: string): { habitCount: number; entryCount: number } {
  if (!content.trim()) throw new Error("백업 파일이 비어 있습니다.");
  let parsed: unknown;
  try { parsed = JSON.parse(content); }
  catch { throw new Error("JSON 백업 파일을 읽을 수 없습니다."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("별하루 백업 형식이 아닙니다.");
  }
  const backup = parsed as Record<string, unknown>;
  if (backup.format !== "byeolharu-backup-v2" || backup.scope !== "guest") {
    throw new Error("별하루 비회원 백업 파일만 가져올 수 있습니다.");
  }
  const state = backup.state;
  if (!state || typeof state !== "object" || Array.isArray(state) ||
      !(state as Record<string, unknown>).entities ||
      typeof (state as Record<string, unknown>).entities !== "object" ||
      Array.isArray((state as Record<string, unknown>).entities)) {
    throw new Error("백업 기록 구조가 올바르지 않습니다.");
  }
  const entries = Object.values((state as { entities: Record<string, unknown> }).entities);
  let habitCount = 0, entryCount = 0;
  for (const value of entries) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entity = value as { kind?: unknown; deleted?: unknown };
    if (entity.deleted === true) continue;
    if (entity.kind === "habits") habitCount += 1;
    if (entity.kind === "habit_entries") entryCount += 1;
  }
  return { habitCount, entryCount };
}

export function guestBackupFilename(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error("유효하지 않은 백업 시간입니다.");
  return "byeolharu-backup-" + date.toISOString().replace(/[:.]/g, "-") + ".json";
}
