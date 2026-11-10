"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-feedback";
export default function ResetPassword() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="auth-page">
      <h1>비밀번호 재설정</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
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
            setBusy(false);
          }
        }}
      >
        <label>
          새 비밀번호
          <input
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </label>
        <button disabled={busy}>비밀번호 변경</button>
      </form>
      <p role="status">{message}</p>
      <a href="/">별하루로 돌아가기</a>
    </main>
  );
}
