"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AndroidReturnLink } from "@/components/account/android-return-link";

export default function AndroidReturnPage() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const inspectLink = (rawUrl: string) => {
      const url = new URL(rawUrl);
      const fragment = new URLSearchParams(url.hash.slice(1));
      // A new email fragment takes precedence over the sanitized status
      // left by an earlier visit to the same document.
      const isError = fragment.size > 0
        ? fragment.has("error") || fragment.has("error_code")
        : url.searchParams.get("error") === "1";
      setFailed(isError);

      // Drop all auth fragments and untrusted query parameters. Preserve only
      // a harmless error flag, so Next.js rerenders and Strict Mode replays
      // cannot turn an expired link into a misleading success screen.
      const safePath = isError ? "/auth/android-return?error=1" : "/auth/android-return";
      if (location.pathname + location.search + location.hash !== safePath) {
        // Keep the router's internal history state when cleaning the URL.
        history.replaceState(history.state, "", safePath);
      }
    };

    inspectLink(location.href);
    // Another email may open this same document with a new hash. The event's
    // newURL is authoritative even if the fragment has already been cleaned.
    const onHashChange = (event: HashChangeEvent) => inspectLink(event.newURL);
    const onPopState = () => inspectLink(location.href);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onPopState);
    try {
      if ((localStorage.getItem("byeolharu_v2_theme") ?? localStorage.getItem("byeolharu_v1_theme")) === "dark") setTheme("dark");
    } catch { /* Optional browser preference. */ }
    setReady(true);
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
