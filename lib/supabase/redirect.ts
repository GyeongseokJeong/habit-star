export function emailAuthRedirect(
  origin: string,
  previewRedirect?: string,
  recovery = false,
) {
  const url = new URL(previewRedirect || "/auth/confirm", origin);
  if (recovery) url.searchParams.set("next", "/auth/reset");
  return url.toString();
}
export function applicationOrigin(
  configured: string | undefined,
  production: boolean,
  requestOrigin?: string,
) {
  const url = new URL(
    configured ??
      (production ? "" : (requestOrigin ?? "http://localhost:3000")),
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
export function authDestination(
  params: URLSearchParams,
  failed: boolean,
  recovery = false,
) {
  return failed
    ? "/?auth=error"
    : recovery || params.get("next") === "/auth/reset"
      ? "/auth/reset"
      : "/";
}
