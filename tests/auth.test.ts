import { it, expect } from "vitest";
import { applicationOrigin, authDestination } from "../lib/supabase/redirect";
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
});
