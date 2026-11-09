import { execFileSync, spawn } from "node:child_process";
// Reads only the CLI-managed LOCAL instance. Never accepts production credentials.
let settings;
try {
  settings = JSON.parse(
    execFileSync("pnpm", ["exec", "supabase", "status", "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
} catch {
  console.error("Start local Supabase before running cloud browser tests.");
  process.exit(1);
}
const url = new URL(settings.API_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "54321")
  throw Error("Only the local test instance is allowed");
const child = spawn(
  "pnpm",
  ["exec", "playwright", "test", "--config", "playwright.cloud.config.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_CLOUD_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        settings.PUBLISHABLE_KEY || settings.ANON_KEY,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
