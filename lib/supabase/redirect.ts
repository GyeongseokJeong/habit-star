export function applicationOrigin(
  configured: string | undefined,
  production: boolean,
) {
  const url = new URL(
    configured ?? (production ? "" : "http://localhost:3000"),
  );
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol) ||
    (production && url.protocol !== "https:")
  )
    throw Error("Invalid application origin");
  return url.origin;
}
export function authDestination(params: URLSearchParams, failed: boolean) {
  return failed
    ? "/?auth=error"
    : params.get("next") === "/auth/reset"
      ? "/auth/reset"
      : "/";
}
