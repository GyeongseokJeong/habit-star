/**
 * Theme selection is device-local, never part of a habit record or cloud sync.
 * Legacy v2 stored "light" on startup even without an explicit choice; treat
 * it as system to avoid pinning all existing Android installs to light.
 * A legacy "dark" value required an explicit user toggle and is retained.
 */
export const THEME_PREFERENCE_KEY = "byeolharu_v3_theme_mode";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export function parseThemePreference(
  saved: string | null,
  legacy: string | null,
): ThemePreference {
  if (saved === "system" || saved === "light" || saved === "dark") return saved;
  return legacy === "dark" ? "dark" : "system";
}

export function resolveTheme(mode: ThemePreference, systemDark: boolean): ResolvedTheme {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}
