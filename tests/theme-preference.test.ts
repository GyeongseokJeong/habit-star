import { describe, expect, it } from "vitest";
import { parseThemePreference, resolveTheme } from "../lib/theme-preference";

describe("device theme preference", () => {
  it("follows the system on a fresh install", () => {
    expect(parseThemePreference(null, null)).toBe("system");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
  });

  it("migrates the implicit legacy light default to system", () => {
    expect(parseThemePreference(null, "light")).toBe("system");
  });

  it("preserves an explicitly selected legacy dark theme", () => {
    expect(parseThemePreference(null, "dark")).toBe("dark");
  });

  it("respects the new explicit selection over any legacy value", () => {
    expect(parseThemePreference("light", "dark")).toBe("light");
    expect(parseThemePreference("dark", "light")).toBe("dark");
    expect(parseThemePreference("system", "dark")).toBe("system");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("uses the system for unknown storage values", () => {
    expect(parseThemePreference("invalid", "light")).toBe("system");
    expect(parseThemePreference("", null)).toBe("system");
  });
});
