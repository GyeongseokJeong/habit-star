import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="byeolharu light legal-page">
      <div className="legal-page-inner">
        <a href="/" className="legal-brand"><Sparkles size={22} aria-hidden="true" /> 별하루</a>
        <h1>{title}</h1>
        {children}
        <nav className="legal-links" aria-label="별하루 정책 안내">
          <a href="/privacy">개인정보처리방침</a>
          <a href="/account-deletion">계정 삭제 요청</a>
          <a href="/">별하루 홈</a>
        </nav>
      </div>
    </main>
  );
}
