"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authErrorMessage } from "@/lib/supabase/auth-feedback";
import { Sparkles } from "lucide-react";
import { PasswordInput } from "@/components/account/password-input";
import { AndroidReturnLink } from "@/components/account/android-return-link";
export default function ResetPassword() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("light");
  const pending = useRef(false);
  const recoveryClient = useRef<SupabaseClient | null>(null);
  const recoveryChecked = useRef(false);
  const recoveryInvalid = useRef(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [androidReturn, setAndroidReturn] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;
    setAndroidReturn(new URLSearchParams(location.search).get("from") === "android");
    const params = new URLSearchParams(window.location.hash.slice(1));
    const recoveryLink = params.has("access_token") || params.has("refresh_token") ||
      params.has("error") || params.get("type") === "recovery";
    if (!recoveryLink) {
      setRecoveryReady(true); // Normal web PKCE recovery keeps using browser cookies.
      return;
    }
    // Drop sensitive credentials from the browser address bar before awaiting
    // any network action. Never copy them to the SSR cookie-based web client.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (params.get("type") !== "recovery" || !access_token || !refresh_token) {
      recoveryInvalid.current = true;
      setMessage("재설정 링크가 유효하지 않습니다. 새 링크를 요청해주세요.");
      setRecoveryReady(true);
      return;
    }
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: "implicit",
        },
      },
    );
    void client.auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) throw error;
        recoveryClient.current = client;
      })
      .catch(() => {
        recoveryInvalid.current = true;
        setMessage("재설정 링크를 확인할 수 없습니다. 새 링크를 요청해주세요.");
      })
      .finally(() => setRecoveryReady(true));
  }, []);
  useEffect(() => {
    try {
      if (
        (localStorage.getItem("byeolharu_v2_theme") ??
          localStorage.getItem("byeolharu_v1_theme")) === "dark"
      )
        setTheme("dark");
    } catch {
      /* Theme preferences are optional when browser storage is blocked. */
    }
  }, []);
  return (
    <main className={`byeolharu ${theme} auth-page-shell`}>
      <div className="auth-page">
        <a href="/" className="brand">
          <Sparkles className="gold" size={25} />
          <span>
            별하루<small>BYEOLHARU</small>
          </span>
        </a>
        <h1>비밀번호 재설정</h1>
        <p>새로운 비밀번호로 나의 하루를 이어가요.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            try {
              const password = new FormData(e.currentTarget).get(
                "password",
              ) as string;
              if (recoveryInvalid.current) throw Error("메일의 재설정 링크를 다시 열어주세요.");
              const client = recoveryClient.current ?? supabase();
              const {
                data: { user },
              } = await client.auth.getUser();
              if (!user) throw Error("메일의 재설정 링크를 다시 열어주세요.");
              const { error } = await client.auth.updateUser({ password });
              if (error) throw error;
              if (recoveryClient.current) {
                // Recovery tokens must not remain in memory after success.
                await client.auth.signOut({ scope: "local" });
                recoveryClient.current = null;
              }
              setPasswordChanged(true);
              setMessage(
                "비밀번호를 변경했습니다. 홈으로 이동해 로그인해주세요.",
              );
            } catch (error) {
              setMessage(
                error instanceof Error &&
                  error.message === "메일의 재설정 링크를 다시 열어주세요."
                  ? error.message
                  : authErrorMessage(error),
              );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          <PasswordInput
            label="새 비밀번호"
            autoComplete="new-password"
            disabled={busy || !recoveryReady}
          />
          <button className="primary full" disabled={busy || !recoveryReady || recoveryInvalid.current} aria-busy={busy}>
            {busy ? "변경 중…" : "비밀번호 변경"}
          </button>
        </form>
        <p role="status" className="auth-feedback">
          {message}
        </p>
        {androidReturn && passwordChanged && <AndroidReturnLink />}
        <a href="/">별하루로 돌아가기</a>
      </div>
    </main>
  );
}
