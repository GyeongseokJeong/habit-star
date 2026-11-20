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
  appId: notificationsPoc
    ? "io.github.gyeongseokjeong.byeolharu.notificationpoc"
    : remoteDebug
      ? "io.github.gyeongseokjeong.byeolharu.webviewpoc"
      : "io.github.gyeongseokjeong.byeolharu.poc",
  appName: notificationsPoc
    ? "별하루 알림 PoC"
    : remoteDebug
      ? "별하루 WebView PoC"
      : "별하루 PoC",
  webDir: "www",
  ...(remoteDebug
    ? { server: { url: productionOrigin, cleartext: false } }
    : {}),
};
export default config;
