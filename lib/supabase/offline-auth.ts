/** Local offline access is only a recovery path for temporary transport failures.
 * An explicit server rejection is not evidence of an offline session. */
export function canUseOfflineVerifiedSession(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const failure = error as { name?: string; status?: number; code?: string };
  if (failure.code && [
    "user_not_found", "session_not_found", "refresh_token_not_found",
    "refresh_token_already_used", "bad_jwt", "invalid_jwt",
  ].includes(failure.code)) return false;
  if (failure.status === 401 || failure.status === 403 || failure.status === 404) return false;
  return failure.name === "AuthRetryableFetchError" ||
    failure.status === 0 || failure.status === 429 ||
    (typeof failure.status === "number" && failure.status >= 500 && failure.status < 600);
}
