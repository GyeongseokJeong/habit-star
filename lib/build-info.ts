/** Shared web/Android UI provenance, injected at each platform's build time. */
export const APP_BUILD_INFO = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
  sha: process.env.NEXT_PUBLIC_BUILD_SHA || "unknown",
  get shortSha() {
    return /^[a-f0-9]{40}$/i.test(this.sha) ? this.sha.slice(0, 8) : "unknown";
  },
} as const;
