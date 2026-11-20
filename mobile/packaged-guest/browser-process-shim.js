/**
 * esbuild inject shim for packages that refer to Node's process identifier.
 * This packaged guest is browser-only. No Node APIs or environment secrets
 * are available to application code.
 */
export const process = Object.freeze({
  browser: true,
  env: Object.freeze({ NODE_ENV: "production" }),
  version: "",
  versions: Object.freeze({}),
});
