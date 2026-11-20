import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android debug PoC only. Default: a bundled, offline placeholder screen.
 * Explicit BYEOLHARU_POC_REMOTE_DEBUG=1: load the existing production website
 * for anonymous WebView UI checks. This is NOT a store-release architecture.
 *
 * Production Supabase/Auth is reachable from the real website; do not use
 * personal/member accounts or important records during the PoC.
 */
const productionOrigin = "https://habit-star-fawn.vercel.app";
const remoteDebug = process.env.BYEOLHARU_POC_REMOTE_DEBUG === "1";
const notificationsPoc = process.env.BYEOLHARU_POC_NOTIFICATIONS === "1";
const reminderStep5 = process.env.BYEOLHARU_POC_REMINDER_STEP5 === "1";
const integrationStep8 = process.env.BYEOLHARU_POC_INTEGRATION_STEP8 === "1";
const packagedGuest = process.env.BYEOLHARU_POC_PACKAGED_GUEST === "1";
if (packagedGuest && (remoteDebug || notificationsPoc || reminderStep5 || integrationStep8)) {
  throw new Error("STEP 9 packaged guest app must be isolated from remote or notification demo modes.");
}
if (integrationStep8 && (!notificationsPoc || reminderStep5 || remoteDebug)) {
  throw new Error("STEP 8 must be an isolated notification app.");
}
if (reminderStep5 && !notificationsPoc) throw new Error("STEP 5 requires isolated notifications mode.");
if (remoteDebug && notificationsPoc) {
  throw new Error("Notification PoC must be isolated from the remote website.");
}
const configuredOrigin = process.env.BYEOLHARU_POC_URL?.trim();

if (configuredOrigin && !remoteDebug) {
  throw new Error("BYEOLHARU_POC_URL requires BYEOLHARU_POC_REMOTE_DEBUG=1.");
}
if (remoteDebug && configuredOrigin) {
  const url = new URL(configuredOrigin);
  if (
    url.origin !== productionOrigin ||
    url.href !== `${productionOrigin}/`
  ) {
    throw new Error("This PoC only allows the explicitly approved HTTPS website origin.");
  }
}

const config: CapacitorConfig = {
  // Different app IDs keep separate WebView storage and allow installing both PoCs.
  appId: packagedGuest
    ? "io.github.gyeongseokjeong.byeolharu.packagedgueststep9"
    : integrationStep8
    ? "io.github.gyeongseokjeong.byeolharu.integrationstep8"
    : reminderStep5
    ? "io.github.gyeongseokjeong.byeolharu.reminderstep5"
    : notificationsPoc
    ? "io.github.gyeongseokjeong.byeolharu.notificationpoc"
    : remoteDebug
      ? "io.github.gyeongseokjeong.byeolharu.webviewpoc"
      : "io.github.gyeongseokjeong.byeolharu.poc",
  appName: packagedGuest
    ? "별하루 비회원 STEP 9"
    : integrationStep8
    ? "별하루 STEP 8 통합 테스트"
    : reminderStep5
    ? "별하루 습관 알림 STEP 5"
    : notificationsPoc
    ? "별하루 알림 PoC"
    : remoteDebug
      ? "별하루 WebView PoC"
      : "별하루 PoC",
  webDir: packagedGuest ? "www-packaged-guest" : "www",
  ...(remoteDebug
    ? { server: { url: productionOrigin, cleartext: false } }
    : {}),
};
export default config;
