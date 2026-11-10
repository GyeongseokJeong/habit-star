"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-feedback";
import { Sparkles } from "lucide-react";
import { PasswordInput } from "@/components/account/password-input";
export default function ResetPassword() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("light");
  const pending = useRef(false);
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
              const {
                data: { user },
              } = await supabase().auth.getUser();
              if (!user) throw Error("메일의 재설정 링크를 다시 열어주세요.");
              const { error } = await supabase().auth.updateUser({ password });
              if (error) throw error;
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
            disabled={busy}
          />
          <button className="primary full" disabled={busy} aria-busy={busy}>
            {busy ? "변경 중…" : "비밀번호 변경"}
          </button>
        </form>
        <p role="status" className="auth-feedback">
          {message}
        </p>
        <a href="/">별하루로 돌아가기</a>
      </div>
    </main>
  );
}
