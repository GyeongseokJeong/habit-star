import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function cloudEnabled() {
  return (
    process.env.NEXT_PUBLIC_CLOUD_ENABLED === "true" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
export function supabase() {
  if (!cloudEnabled())
    throw Error(
      "클라우드 연결이 설정되지 않았습니다. 비회원 모드는 계속 사용할 수 있어요.",
    );
  // Android WebView owns an isolated localStorage session, not Next.js
  // browser cookies. Never share sessions via URL fragments or the website.
  if (process.env.NEXT_PUBLIC_ANDROID_PACKAGED_GUEST === "true") {
    return (client ??= createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          storage: localStorage,
          storageKey: "byeolharu_android_auth_v1",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "implicit",
        },
        global: {
          fetch: (input, init) => fetch(input, {
            ...init,
            signal: AbortSignal.any([
              ...(init?.signal ? [init.signal] : []),
              AbortSignal.timeout(15000),
            ]),
          }),
        },
      },
    ));
  }
  return (client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([
              ...(init?.signal ? [init.signal] : []),
              AbortSignal.timeout(15000),
            ]),
          }),
      },
    },
  ));
}
