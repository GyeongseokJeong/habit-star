import type { State } from "./repository";
export type SyncMetadata = {
  phase: "syncing" | "succeeded" | "waiting" | "failed" | "auth_required";
  attemptId?: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastSuccessLocalRevision?: number;
  lastSuccessCursor?: number;
  error?: string;
};
export function syncStatus(member: boolean, state: State): string {
  if (!member) return "로컬 저장 완료";
  if (state.sync?.phase === "auth_required") return "인증 만료";
  if (state.sync?.phase === "failed") return "동기화 실패";
  if (
    state.conflicts.some((c) => !c.resolved) ||
    state.importJournal?.phase === "conflict"
  )
    return "기록 충돌";
  if (state.sync?.phase === "syncing") return "클라우드 동기화 중";
  if (
    !state.hydrated ||
    state.outbox.length ||
    state.importJournal ||
    state.sync?.phase !== "succeeded" ||
    !state.sync.lastSuccessAt ||
    state.sync.lastSuccessLocalRevision !== (state.localRevision ?? 0) ||
    !Number.isSafeInteger(state.sync.lastSuccessCursor) ||
    state.sync.lastSuccessCursor! > state.cursor
  )
    return "동기화 대기";
  return "클라우드 동기화 완료";
}
export function errorCode(error: unknown) {
  return error instanceof Error ? error.message : "sync_failed";
}
export function failurePhase(
  error: unknown,
): "waiting" | "failed" | "auth_required" {
  const code = errorCode(error);
  return code === "auth_required"
    ? "auth_required"
    : /network_unavailable|Failed to fetch|fetch failed|NetworkError|offline/i.test(
          code,
        )
      ? "waiting"
      : "failed";
}
