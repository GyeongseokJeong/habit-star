import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Single supported Android build: bundled, offline-capable guest test APK.
 * This is NOT a Play Store release configuration. Preserve the existing app
 * identity and WebView storage boundary until a separately reviewed migration.
 *
 * Generate www-packaged-guest before running Capacitor commands. No remote
 * server URL or old standalone notification/WebView demos are supported.
 */
if (process.env.BYEOLHARU_POC_PACKAGED_GUEST !== "1") {
  throw new Error(
    "Only the packaged guest APK is supported. Set BYEOLHARU_POC_PACKAGED_GUEST=1 and build the local web bundle first.",
  );
}

const config: CapacitorConfig = {
  appId: "io.github.gyeongseokjeong.byeolharu.packagedgueststep9",
  appName: "별하루 비회원 STEP 9",
  webDir: "www-packaged-guest",
  // MainActivity handles real system-bar insets; avoid double CSS padding.
  plugins: { SystemBars: { insetsHandling: "disable" } },
};

export default config;
