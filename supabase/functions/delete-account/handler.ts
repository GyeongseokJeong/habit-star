// No account identifier supplied by the caller can select the deletion target.
export type ConfirmedUser = { id: string; email: string; confirmed: boolean };
type Dependencies = {
  identify: (token: string) => Promise<ConfirmedUser | null>;
  verifyPassword: (email: string, password: string) => Promise<string | null>;
  hardDelete: (id: string) => Promise<boolean>;
};

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export function createDeleteAccountHandler(deps: Dependencies) {
  const reply = (status: number, code: string) =>
    new Response(JSON.stringify({ code }), { status, headers });
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply(405, "method_not_allowed");
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("Authorization") ?? "");
    if (!match) return reply(401, "auth_required");
    try {
      const target = await deps.identify(match[1]);
      if (!target?.confirmed || !target.email) return reply(401, "auth_required");
      let body: unknown;
      try { body = await request.json(); }
      catch { return reply(400, "invalid_request"); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, "invalid_request");
      const { password, confirm } = body as Record<string, unknown>;
      if (confirm !== true || typeof password !== "string" || !password || password.length > 1024)
        return reply(400, "invalid_request");
      // Reauthenticate the email derived from the verified bearer token, never
      // from the request. The returned identity must match exactly.
      if (await deps.verifyPassword(target.email, password) !== target.id)
        return reply(403, "password_invalid");
      // Auth hard deletion revokes the account's sessions; account-owned rows
      // cascade transactionally. Existing JWTs are rejected by private.owner().
      if (!await deps.hardDelete(target.id)) return reply(503, "delete_failed");
      return reply(200, "deleted");
    } catch {
      // Never log passwords, tokens, email addresses or upstream error bodies.
      return reply(503, "delete_failed");
    }
  };
}
