import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "cloud.spec.ts",
  workers: 1,
  timeout: 90000,
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
    timeout: 120000,
    env: { NEXT_PUBLIC_CLOUD_ENABLED: "true", NEXT_TELEMETRY_DISABLED: "1" },
  },
  reporter: "list",
});
