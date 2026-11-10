"use client";
import { useEffect, useRef, useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-feedback";
import { emailAuthRedirect } from "@/lib/supabase/redirect";
import { PasswordInput } from "./password-input";

export function AuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown > 0]);
  const redirect = (reset = false) =>
    emailAuthRedirect(
      location.origin,
      process.env.NODE_ENV === "production"
        ? undefined
        : process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL,
      reset,
    );
  const switchMode = (next: typeof mode) => {
    setMode(next);
    setMessage("");
    setFailed(false);
    setResendOpen(false);
  };
  return (
    <div className="auth-form">
      <div className="auth-intro">
        <Sparkles size={22} className="gold" aria-hidden="true" />
        <h3>
          {mode === "reset"
            ? "다시, 나의 하루로"
            : "어디서든 이어지는 나의 하루"}
        </h3>
        <p>
          {mode === "reset"
            ? "이메일로 비밀번호 재설정 링크를 보내드려요."
            : "이메일로 로그인하고 작은 실천을 안전하게 모아보세요."}
        </p>
      </div>
      <div
        className="account-modes"
        role="group"
        aria-label="로그인 및 회원가입"
      >
        <button
          type="button"
          aria-pressed={mode === "login"}
          disabled={busy}
          onClick={() => switchMode("login")}
        >
          로그인
        </button>
        <button
          type="button"
          aria-pressed={mode === "signup"}
          disabled={busy}
          onClick={() => switchMode("signup")}
        >
          회원가입
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending.current) return;
          pending.current = true;
          const password = new FormData(e.currentTarget).get(
            "password",
          ) as string;
          setBusy(true);
          setMessage("");
          setFailed(false);
          try {
            const client = supabase();
            const result =
              mode === "signup"
                ? await client.auth.signUp({
                    email: email.trim(),
                    password,
                    options: { emailRedirectTo: redirect() },
                  })
                : mode === "reset"
                  ? await client.auth.resetPasswordForEmail(email.trim(), {
                      redirectTo: redirect(true),
                    })
                  : await client.auth.signInWithPassword({
                      email: email.trim(),
                      password,
                    });
            if (result.error) throw result.error;
            if (mode === "login") onAuthenticated();
            if (mode === "signup") {
              setResendOpen(true);
              setCooldown(60);
            }
            setMessage(
              mode === "login"
                ? "로그인했습니다."
                : mode === "signup"
                  ? "가입 요청을 처리했습니다. 이메일의 인증 링크를 확인해주세요."
                  : "요청을 처리했습니다. 이메일을 확인해주세요.",
            );
          } catch (error) {
            setFailed(true);
            setMessage(authErrorMessage(error));
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <label className="field">
          이메일
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== "reset" && (
          <PasswordInput
            key={mode}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            disabled={busy}
          />
        )}
        <button className="primary full" disabled={busy} aria-busy={busy}>
          {busy
            ? "처리 중…"
            : mode === "login"
              ? "로그인"
              : mode === "signup"
                ? "이메일로 회원가입"
                : "재설정 메일 보내기"}
        </button>
      </form>
      <div className="auth-links">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => switchMode(mode === "reset" ? "login" : "reset")}
        >
          {mode === "reset" ? "로그인으로 돌아가기" : "비밀번호 찾기"}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          aria-expanded={resendOpen}
          onClick={() => setResendOpen(!resendOpen)}
        >
          인증 메일이 오지 않았나요?
        </button>
      </div>
      {resendOpen && (
        <form
          className="resend-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending.current || cooldown) return;
            pending.current = true;
            setBusy(true);
            setFailed(false);
            setMessage("");
            try {
              const { error } = await supabase().auth.resend({
                type: "signup",
                email: email.trim(),
                options: { emailRedirectTo: redirect() },
              });
              if (error) throw error;
              setCooldown(60);
              setMessage("요청을 처리했습니다. 이메일을 확인해주세요.");
            } catch (error) {
              if (
                typeof error === "object" &&
                error &&
                "status" in error &&
                error.status === 429
              )
                setCooldown(60);
              setFailed(true);
              setMessage(authErrorMessage(error));
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          <p className="auth-note">
            스팸함도 확인해주세요. 가입한 이메일로 인증 링크를 다시 보내드려요.
          </p>
          <label className="field">
            인증받을 이메일
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="secondary full" disabled={busy || cooldown > 0}>
            <Mail size={16} />
            {cooldown
              ? `${cooldown}초 후 재발송 가능`
              : "인증 메일 다시 보내기"}
          </button>
        </form>
      )}
      <p
        role="status"
        aria-live="polite"
        className={`auth-feedback ${failed ? "error" : ""}`}
      >
        {message}
      </p>
    </div>
  );
}
