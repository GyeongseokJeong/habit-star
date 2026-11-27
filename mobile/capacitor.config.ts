import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Unified Android app: bundled, offline-capable guest UI only.
 * Preserve this test applicationId until data migration is designed.
 */
const retiredModes = [
  "BYEOLHARU_POC_REMOTE_DEBUG",
  "BYEOLHARU_POC_URL",
  "BYEOLHARU_POC_NOTIFICATIONS",
  "BYEOLHARU_POC_REMINDER_STEP5",
  "BYEOLHARU_POC_INTEGRATION_STEP8",
];
for (const name of retiredModes) {
  if (process.env[name]) {
    throw new Error("Retired Android mode is no longer supported: " + name);
  }
}
const config: CapacitorConfig = {
  appId: "io.github.gyeongseokjeong.byeolharu.packagedgueststep9",
  appName: "별하루 비회원 STEP 9",
  ...(process.env.BYEOLHARU_ANDROID_RELEASE === "1" && {
    appId: "app.byeolharu.android",
    appName: "별하루",
  }),
  webDir: "www-packaged-guest",
  // MainActivity handles physical insets. Never double-apply system-bar insets.
  plugins: {
    SystemBars: { insetsHandling: "disable" as const },
    LocalNotifications: { smallIcon: "ic_stat_byeolharu" },
  },
};
export default config;
