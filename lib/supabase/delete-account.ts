import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestAccountDeletion(client: SupabaseClient, userId: string, password: string) {
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session || session.user.id !== userId)
    throw Error("로그인 상태를 확인해 주세요. 다시 로그인한 뒤 탈퇴할 수 있어요.");
  // Pin the verified UI account's token, even if a concurrent tab changes sessions.
  const { data, error } = await client.functions.invoke("delete-account", {
    headers: { Authorization: "Bearer " + session.access_token },
    body: { password, confirm: true },
  });
  if (!error && data?.code === "deleted") return;
  if (error) {
    let code: string | undefined;
    try { code = (await error.context?.json())?.code; } catch {}
    if (code === "password_invalid") throw Error("비밀번호가 일치하지 않아요.");
    if (code === "auth_required") throw Error("다시 로그인한 뒤 탈퇴해 주세요.");
  }
  throw Error("탈퇴 결과를 확인하지 못했어요. 연결을 확인한 후 다시 시도해 주세요.");
}
