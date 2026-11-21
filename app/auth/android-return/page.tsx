"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { AndroidReturnLink } from "@/components/account/android-return-link";

export default function AndroidReturnPage() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState("light");
  const initialLinkInspected = useRef(false);
  useEffect(() => {
    // A second email link can navigate to the same document using only a
    // different fragment. Browser hash navigation does not remount React.
    // Re-evaluate it on hashchange as well as on the initial page load.
    const inspectLink = () => {
      const query = new URLSearchParams(location.search);
      const fragment = new URLSearchParams(location.hash.slice(1));
      setFailed(query.get("error") === "1" || fragment.has("error") || fragment.has("error_code"));
      // Never retain/forward signup tokens in browser history or Android intent.
      history.replaceState(null, "", location.pathname);
    };
    // Dev Strict Mode replays effects while keeping refs. A second pass must
    // not read the URL after credentials/error details have been removed.
    if (!initialLinkInspected.current) {
      initialLinkInspected.current = true;
      inspectLink();
    }
    window.addEventListener("hashchange", inspectLink);
    window.addEventListener("popstate", inspectLink);
    try {
      if ((localStorage.getItem("byeolharu_v2_theme") ?? localStorage.getItem("byeolharu_v1_theme")) === "dark") setTheme("dark");
    } catch { /* Optional browser preference. */ }
    setReady(true);
    return () => {
      window.removeEventListener("hashchange", inspectLink);
      window.removeEventListener("popstate", inspectLink);
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
