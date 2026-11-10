import { it, expect } from "vitest";
import {
  applicationOrigin,
  authDestination,
  emailAuthRedirect,
} from "../lib/supabase/redirect";
it("routes preview email links through the configured v0 proxy", () => {
  const proxy = "https://v0.app/chat/api/supabase/redirect/chat-test";
  expect(emailAuthRedirect("https://preview.v0.build", proxy)).toBe(proxy);
  const recovery = new URL(
    emailAuthRedirect("https://preview.v0.build", proxy, true),
  );
  expect(recovery.origin + recovery.pathname).toBe(proxy);
  expect(recovery.searchParams.get("next")).toBe("/auth/reset");
  expect(emailAuthRedirect("https://habit.example")).toBe(
    "https://habit.example/auth/confirm",
  );
});
it("keeps development callbacks on the active origin without changing production trust", () => {
  expect(applicationOrigin(undefined, false, "https://preview.v0.build")).toBe(
    "https://preview.v0.build",
  );
  expect(
    applicationOrigin(
      "https://habit.example",
      true,
      "https://attacker.example",
    ),
  ).toBe("https://habit.example");
  expect(() =>
    applicationOrigin(undefined, true, "https://attacker.example"),
  ).toThrow();
});
it("uses a configured canonical origin instead of untrusted Host or next URL", () => {
  expect(applicationOrigin(undefined, false)).toBe("http://localhost:3000");
  expect(applicationOrigin("https://habit.example", true)).toBe(
    "https://habit.example",
  );
  expect(() => applicationOrigin(undefined, true)).toThrow();
  expect(() => applicationOrigin("http://habit.example", true)).toThrow();
  expect(() =>
    applicationOrigin("https://user:secret@habit.example", true),
  ).toThrow();
  expect(
    authDestination(
      new URLSearchParams("next=https://attacker.example"),
      false,
    ),
  ).toBe("/");
  expect(authDestination(new URLSearchParams("next=/auth/reset"), false)).toBe(
    "/auth/reset",
  );
  expect(authDestination(new URLSearchParams(), false, true)).toBe(
    "/auth/reset",
  );
  expect(authDestination(new URLSearchParams(), true, true)).toBe(
    "/?auth=error",
  );
});
