import { expect, it } from "vitest";
import { authErrorMessage } from "../lib/supabase/auth-feedback";
it.each([
  [{ status: 429 }, "잠시 제한"],
  [{ code: "over_email_send_rate_limit" }, "잠시 제한"],
  [{ code: "email_not_confirmed" }, "이메일 인증"],
  [{ code: "email_address_not_authorized" }, "메일 발송 설정"],
  [{ code: "weak_password" }, "안전한 비밀번호"],
  [{ code: "same_password" }, "다른 비밀번호"],
])(
  "provides actionable feedback without exposing raw errors: %j",
  (error, text) => {
    expect(authErrorMessage(error)).toContain(text);
  },
);
it("does not distinguish invalid credentials from an existing account", () => {
  const message = authErrorMessage({ code: "invalid_credentials" });
  expect(authErrorMessage({ code: "user_already_exists" })).toBe(message);
  expect(authErrorMessage({ code: "email_exists" })).toBe(message);
});
it("does not expose unexpected error details", () => {
  const message = authErrorMessage(new Error("private diagnostic detail"));
  expect(message).toContain("예상하지 못한 오류");
  expect(message).not.toContain("private diagnostic detail");
  expect(authErrorMessage(null)).toBe(message);
});
