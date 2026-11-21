"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/auth-feedback";
import { emailAuthRedirect } from "@/lib/supabase/redirect";
import { PasswordInput } from "./password-input";

export type AuthMode = "login" | "signup" | "reset";

export function AuthForm({
  mode,
  onModeChange,
  onAuthenticated,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onAuthenticated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(Math.max(0, cooldown - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const androidPackaged = process.env.NEXT_PUBLIC_ANDROID_PACKAGED_GUEST === "true";
  const redirect = (reset = false) =>
    emailAuthRedirect(
      androidPackaged ? process.env.NEXT_PUBLIC_SITE_URL! : location.origin,
      androidPackaged || process.env.NODE_ENV === "production"
        ? undefined
        : process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL,
      reset,
    );
  const goTo = (next: AuthMode) => {
    setMessage("");
    setFailed(false);
    setResendOpen(false);
    onModeChange(next);
  };
  const resend = async () => {
    if (pending.current || cooldown || !email.trim()) return;
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
      if (typeof error === "object" && error && "status" in error && error.status === 429)
        setCooldown(60);
      setFailed(true);
      setMessage(authErrorMessage(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  if (sent) return (
    <div className="auth-form auth-sent">
      <CheckCircle2 size={34} className="auth-emblem" aria-hidden="true" />
      <h3>{mode === "signup" ? "이메일 인증이 필요해요" : "메일을 확인해주세요"}</h3>
      <p>{mode === "signup"
        ? "가입 요청을 처리했습니다. 이메일의 인증 링크를 확인해주세요."
        : "요청을 처리했습니다. 가입한 이메일의 메일함을 확인해주세요."}</p>
      <p className="auth-email">{email}</p>
      {mode === "signup" && <p className="auth-note">이미 인증된 이메일은 새 인증 메일이 오지 않을 수 있어요. 기존 계정으로 로그인해주세요.</p>}
      {mode === "signup" && (
        <button type="button" className="secondary full account-action" disabled={busy || cooldown > 0} onClick={() => void resend()}>
          <Mail size={16} />{cooldown ? String(cooldown) + "초 후 재발송 가능" : "인증 메일 다시 보내기"}
        </button>
      )}
      <p className="auth-note">{androidPackaged
        ? "인증 링크는 웹 브라우저에서 열려요. 인증 후 이 앱으로 돌아와 로그인해주세요."
        : "메일이 보이지 않으면 스팸함도 확인해주세요."}</p>
      <button type="button" className="text-button auth-inline-link" onClick={() => goTo("login")}>로그인으로 돌아가기 <ArrowRight size={15} /></button>
      <p role="status" aria-live="polite" className={"auth-feedback " + (failed ? "error" : "")}>{message}</p>
    </div>
  );
  return (
    <div className={"auth-form auth-" + mode}>
      <div className="auth-intro">
        {mode === "signup" ? <Sparkles size={26} className="gold" aria-hidden="true" />
          : mode === "reset" ? <Mail size={26} className="gold" aria-hidden="true" />
          : <LockKeyhole size={26} className="gold" aria-hidden="true" />}
        <h3>{mode === "login" ? "다시, 나의 별하루로" : mode === "signup" ? "별하루에 오신 걸 환영해요" : "비밀번호를 다시 설정해요"}</h3>
        <p>{mode === "login" ? "기록해 온 작은 실천을 이어가세요." : mode === "signup" ? "오늘부터 나만의 작은 실천을 모아보세요." : "가입한 이메일로 재설정 링크를 보내드려요."}</p>
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setMessage("");
        setFailed(false);
        try {
          const password = new FormData(e.currentTarget).get("password") as string;
          const client = supabase();
          const result = mode === "signup"
            ? await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect() } })
            : mode === "reset"
              ? await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect(true) })
              : await client.auth.signInWithPassword({ email: email.trim(), password });
          if (result.error) throw result.error;
          if (mode === "login") {
            setMessage("로그인했습니다.");
            onAuthenticated();
          } else {
            setSent(true);
            if (mode === "signup") setCooldown(60);
          }
        } catch (error) {
          setFailed(true);
          setMessage(authErrorMessage(error));
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}>
        <label className="field">
          이메일
          <input type="email" name="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" placeholder="you@example.com" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== "reset" && (
          <PasswordInput key={mode} autoComplete={mode === "signup" ? "new-password" : "current-password"} disabled={busy} />
        )}
        {mode === "signup" && <p className="auth-note">{androidPackaged
          ? "이메일을 웹 브라우저에서 인증한 뒤 앱에서 로그인해주세요. 비회원 기록은 자동으로 이전되지 않습니다."
          : "이메일 인증 후 사용할 수 있어요. 비회원 기록은 자동으로 이전되지 않습니다."}</p>}
        <button className={"full account-action " + (mode === "signup" ? "account-signup-action" : "primary")} disabled={busy} aria-busy={busy}>
          {busy ? "처리 중…" : mode === "login" ? "로그인" : mode === "signup" ? "이메일로 회원가입" : "재설정 메일 보내기"}
        </button>
      </form>
      <div className="auth-links account-auth-links">
        {mode === "login" && <button type="button" className="text-button" disabled={busy} onClick={() => goTo("reset")}>비밀번호 찾기</button>}
        {mode !== "reset" && <button type="button" className="text-button" disabled={busy} onClick={() => { setResendOpen(!resendOpen); setMessage(""); }}>
          인증 메일이 오지 않았나요?
        </button>}
      </div>
      {resendOpen && (
        <form className="resend-form" onSubmit={(e) => { e.preventDefault(); void resend(); }}>
          <p className="auth-note">스팸함도 확인해주세요. 가입한 이메일로 인증 링크를 다시 보내드려요.</p>
          <label className="field">인증받을 이메일
            <input type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="secondary full" disabled={busy || cooldown > 0}><Mail size={16} />{cooldown ? String(cooldown) + "초 후 재발송 가능" : "인증 메일 다시 보내기"}</button>
        </form>
      )}
      <div className="auth-switch">
        {mode === "login" ? <><span>처음 오셨나요?</span><button type="button" disabled={busy} onClick={() => goTo("signup")}>회원가입</button></>
          : <><span>{mode === "signup" ? "이미 계정이 있으신가요?" : "기억나셨나요?"}</span><button type="button" disabled={busy} onClick={() => goTo("login")}>로그인</button></>}
      </div>
      <p role="status" aria-live="polite" className={"auth-feedback " + (failed ? "error" : "")}>{message}</p>
    </div>
  );
}
