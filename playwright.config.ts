import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  testIgnore: ["**/cloud.spec.ts", "**/production.spec.ts"],
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_CLOUD_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL:
        "http://localhost:3000/auth/confirm",
    },
  },
  reporter: "list",
});
