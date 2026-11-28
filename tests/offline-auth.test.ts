import { describe, expect, it } from "vitest";
import { canUseOfflineVerifiedSession } from "../lib/supabase/offline-auth";

describe("offline verified identity", () => {
  it.each([
    { name: "AuthRetryableFetchError", status: 0 },
    { name: "AuthRetryableFetchError", status: 503 },
    { status: 429 },
    { status: 500 },
  ])("preserves the existing verified-cache fallback for a transient failure %o", (error) => {
    expect(canUseOfflineVerifiedSession(error)).toBe(true);
  });

  it.each([
    { code: "user_not_found", status: 404 },
    { code: "session_not_found", status: 403 },
    { code: "refresh_token_not_found", status: 400 },
    { code: "refresh_token_already_used", status: 400 },
    { code: "bad_jwt", status: 401 },
    { status: 401 },
    { name: "AuthSessionMissingError", status: 400 },
    { name: "AuthRetryableFetchError", status: 403 },
    { code: "user_not_found", status: 500 },
    new Error("unknown"),
    null,
  ])("does not unlock a member cache after an explicit or unknown denial %o", (error) => {
    expect(canUseOfflineVerifiedSession(error)).toBe(false);
  });
});
