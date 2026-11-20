import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android shell experiment ONLY. By default, the APK contains a local
 * placeholder; it cannot silently load or authenticate against production.
 *
 * A remote Next.js origin must be explicitly opted into for a debug-only
 * WebView check. Capacitor server.url is NOT an app-store architecture.
 */
const devOrigin = process.env.BYEOLHARU_POC_URL?.trim();
const allowRemote = process.env.BYEOLHARU_POC_REMOTE_DEBUG === "1";
let server: CapacitorConfig["server"];

if (devOrigin) {
  if (!allowRemote) {
    throw new Error("Remote debug requires BYEOLHARU_POC_REMOTE_DEBUG=1.");
  }
  const url = new URL(devOrigin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !url.hostname
  ) {
    throw new Error("BYEOLHARU_POC_URL must be a clean HTTPS origin.");
  }
  server = { url: url.origin, cleartext: false };
} else if (allowRemote) {
  throw new Error("Set BYEOLHARU_POC_URL when enabling remote debug.");
}

const config: CapacitorConfig = {
  appId: "io.github.gyeongseokjeong.byeolharu.poc",
  appName: "별하루 PoC",
  webDir: "www",
  ...(server ? { server } : {}),
};
export default config;
