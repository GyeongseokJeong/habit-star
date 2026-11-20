/**
 * Native resume and document visibility can both fire for the same return.
 * Deduplicate refresh requests; the repository is the single source of
 * today's stored habits and must refresh before reminders are reconciled.
 */
export function createResumeDispatcher(emit, { clock = () => Date.now(), minGapMs = 800 } = {}) {
  if (typeof emit !== "function" || typeof clock !== "function" || !Number.isFinite(minGapMs) || minGapMs < 0) {
    throw new Error("잘못된 앱 복귀 이벤트 설정");
  }
  let last = -Infinity;
  return () => {
    const now = clock();
    if (!Number.isFinite(now)) return false;
    if (now - last < minGapMs) return false;
    last = now;
    emit();
    return true;
  };
}
