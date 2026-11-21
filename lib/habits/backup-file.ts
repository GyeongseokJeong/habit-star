/**
 * Validate the non-secret metadata of a portable Byeolharu v2 backup.
 * The repository remains the final authority for entity and conflict checks.
 */
export const MAX_GUEST_BACKUP_BYTES = 25 * 1024 * 1024;
export const MAX_BACKUP_BYTES = MAX_GUEST_BACKUP_BYTES;
const SCOPE_PATTERN = /^(guest|member:[A-Za-z0-9_-]{1,128})$/;

export function inspectPortableBackup(
  content: string,
  expectedScope?: string,
): { scope: string; habitCount: number; entryCount: number } {
  if (!content.trim()) throw new Error("백업 파일이 비어 있습니다.");
  let parsed: unknown;
  try { parsed = JSON.parse(content); }
  catch { throw new Error("JSON 백업 파일을 읽을 수 없습니다."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("별하루 백업 형식이 아닙니다.");
  }
  const data = parsed as Record<string, unknown>;
  if (data.format !== "byeolharu-backup-v2" ||
      typeof data.scope !== "string" || !SCOPE_PATTERN.test(data.scope)) {
    throw new Error("별하루 비회원 또는 회원 백업 형식이 아닙니다.");
  }
  if (expectedScope !== undefined && data.scope !== expectedScope) {
    throw new Error("현재 로그인한 계정 또는 비회원 범위의 백업만 복원할 수 있습니다.");
  }
  const state = data.state;
  if (!state || typeof state !== "object" || Array.isArray(state) ||
      !(state as Record<string, unknown>).entities ||
      typeof (state as Record<string, unknown>).entities !== "object" ||
      Array.isArray((state as Record<string, unknown>).entities)) {
    throw new Error("백업 기록 구조가 올바르지 않습니다.");
  }
  const entities = Object.values((state as { entities: Record<string, unknown> }).entities);
  let habitCount = 0, entryCount = 0;
  for (const value of entities) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entity = value as { kind?: unknown; deleted?: unknown };
    if (entity.deleted === true) continue;
    if (entity.kind === "habits") habitCount++;
    if (entity.kind === "habit_entries") entryCount++;
  }
  return { scope: data.scope, habitCount, entryCount };
}

/** Preserve the existing guest-only validation contract for guest import. */
export function inspectGuestBackup(content: string): { habitCount: number; entryCount: number } {
  const { scope, habitCount, entryCount } = inspectPortableBackup(content);
  if (scope !== "guest") throw new Error("별하루 비회원 백업 파일만 가져올 수 있습니다.");
  return { habitCount, entryCount };
}

export function guestBackupFilename(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error("유효하지 않은 백업 시간입니다.");
  return "byeolharu-backup-" + date.toISOString().replace(/[:.]/g, "-") + ".json";
}

export function memberBackupFilename(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error("유효하지 않은 백업 시간입니다.");
  // Do not leak the account ID or email through shared filenames.
  return "byeolharu-member-backup-" + date.toISOString().replace(/[:.]/g, "-") + ".json";
}
