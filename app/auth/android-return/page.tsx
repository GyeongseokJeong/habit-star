"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AndroidReturnLink } from "@/components/account/android-return-link";

export default function AndroidReturnPage() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    // Email callbacks load this page through a browser navigation. Resolve
    // the initial fragment, then strip credentials from the address bar.
    const fragment = new URLSearchParams(location.hash.slice(1));
    const isError = fragment.size > 0
      ? fragment.has("error") || fragment.has("error_code")
      : new URLSearchParams(location.search).get("error") === "1";
    setFailed(isError);

    // Keep only a harmless error flag: Strict Mode and Next navigation can
    // reread the sanitized URL without losing the expired-link warning.
    const safePath = isError ? "/auth/android-return?error=1" : "/auth/android-return";
    if (location.pathname + location.search + location.hash !== safePath) {
      history.replaceState(history.state, "", safePath);
    }

    try {
      if ((localStorage.getItem("byeolharu_v2_theme") ?? localStorage.getItem("byeolharu_v1_theme")) === "dark") setTheme("dark");
    } catch { /* Optional browser preference. */ }
    setReady(true);
  }, []);
  return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
  return (
    <main className={`byeolharu ${theme} auth-page-shell`}>
      <div className="auth-page">
        <a href="/" className="brand"><Sparkles className="gold" size={25}/><span>별하루<small>BYEOLHARU</small></span></a>
        <h1>{failed ? "인증 링크를 다시 확인해주세요" : "나의 별하루로 돌아가기"}</h1>
        <p>{failed ? "앱에서 새 인증 메일을 요청할 수 있어요." : "메일에서 인증을 마쳤다면 앱으로 돌아와 로그인해주세요."}</p>
        {ready && <AndroidReturnLink />}
        <a href="/">웹에서 계속하기</a>
        <p className="auth-note">앱이 열리지 않으면 별하루 아이콘을 직접 눌러주세요.</p>
      </div>
    </main>
  );
}
