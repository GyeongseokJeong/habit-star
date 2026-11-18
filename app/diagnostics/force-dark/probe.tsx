"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./probe.module.css";

type Variant = "baseline" | "declared" | "optout";

const options: { id: Variant; title: string; explanation: string }[] = [
  {
    id: "baseline",
    title: "A · 현행 방식",
    explanation: "별하루 다크 테마만 사용. color-scheme 메타 선언 없음",
  },
  {
    id: "declared",
    title: "B · 테마 지원 명시",
    explanation: '문서 메타 light dark + HTML color-scheme: light dark',
  },
  {
    id: "optout",
    title: "C · 자동 변환 제외 시도",
    explanation: 'B의 메타 + HTML/앱 color-scheme: only light 실험',
  },
];

function sample(selector: string) {
  const element = document.querySelector(selector);
  if (!element) return null;
  const style = getComputedStyle(element);
  return { background: style.backgroundColor, color: style.color, colorScheme: style.colorScheme };
}

function getDiagnostic() {
  return {
    osDark: matchMedia("(prefers-color-scheme: dark)").matches,
    forcedColors: matchMedia("(forced-colors: active)").matches,
    metaScheme: document.querySelector('meta[name="color-scheme"]')?.getAttribute("content") ?? null,
    htmlScheme: getComputedStyle(document.documentElement).colorScheme,
    appScheme: sample("[data-force-dark-variant]")?.colorScheme,
    page: sample("[data-force-dark-variant]"),
    panel: sample("[data-experiment-panel]"),
    day0: sample('[data-experiment-day="0"]'),
    day3: sample('[data-experiment-day="3"]'),
    gold: sample('[data-experiment-day="5"]'),
    disabled: sample('[data-experiment-day="disabled"]'),
  };
}

export default function ForceDarkProbe({ variant }: { variant: Variant }) {
  const [result, setResult] = useState<ReturnType<typeof getDiagnostic> | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setResult(getDiagnostic()));
    return () => window.cancelAnimationFrame(frame);
  }, [variant]);

  return (
    <main className={`byeolharu dark ${styles.page}`} data-force-dark-variant={variant}>
      <div className={styles.shell}>
        <header className={styles.heading}>
          <p className={styles.overline}>별하루 · Samsung Internet 실기기 실험</p>
          <h1>웹페이지 강제 다크 A/B/C</h1>
          <p>세 URL은 처음 로딩될 때 서로 다른 테마 선언을 사용합니다. 같은 삼성 인터넷 설정에서 각각 열어 비교해 주세요.</p>
        </header>
        <nav className={styles.navigation} aria-label="강제 다크 실험 전환">
          {options.map((option) => (
            <Link
              key={option.id}
              className={`${styles.navItem} ${variant === option.id ? styles.navSelected : ""}`}
              href={`/diagnostics/force-dark/${option.id}`}
              aria-current={variant === option.id ? "page" : undefined}
            >
              {option.title}
            </Link>
          ))}
        </nav>
        <p className={styles.explanation}>
          {options.find((item) => item.id === variant)?.explanation}
        </p>
        <section className={`panel matrix-panel ${styles.samplePanel}`} data-experiment-panel aria-label="별점 매트릭스 색상 샘플">
          <div className="section-label"><span>✦ 별점 매트릭스</span></div>
          <div className="calendar-heading">
            <h3>2026년 <strong>11월</strong></h3>
            <span className={styles.chevrons} aria-hidden="true">‹　›</span>
          </div>
          <div className="calendar-grid weekday" aria-hidden="true">
            {["일","월","화","수","목","금","토"].map(day => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid days">
            {Array.from({ length: 14 }, (_, index) => {
              const tier = index <= 5 ? index : index === 7 ? 0 : index === 8 ? 4 : 0;
              const disabled = index >= 9;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={disabled}
                  className={`day-tile tier-${tier} ${index === 8 ? "today" : ""}`}
                  data-experiment-day={disabled && index === 9 ? "disabled" : index <= 5 ? String(index) : undefined}
                  aria-label={`색상 샘플 ${index+10}일 ${disabled ? "비활성" : tier + "점"}`}
                >
                  {index + 10}
                  {index === 8 ? <span className="today-dot" /> : null}
                </button>
              );
            })}
          </div>
          <div className="matrix-legend">
            <span>아직은 작은 별</span>
            <div aria-hidden="true">{[0,1,2,3,4,5].map(tier => <span className={`tier-${tier}`} key={tier} />)}</div>
            <span>빛나는 하루</span>
          </div>
          <div className="calendar-summary">
            <div><span>이번 달 기록</span><b>6 <small>일</small></b></div>
            <div><span>평균 별점</span><b className="gold">★ 4.3</b></div>
          </div>
          <p className="calendar-footnote">하나의 별이 모여, 나만의 우주가 돼요.</p>
        </section>
        <section className={styles.controls} aria-label="버튼 및 선택 색상">
          <button type="button" className="primary">＋ 새 습관 추가</button>
          <div className={styles.selectedItem}>☆ 별점 선택됨</div>
          <div className={styles.unselectedItem}>미선택 항목</div>
        </section>
        <section className={styles.readout}>
          <h2>계산된 CSS 색상</h2>
          <p>계산색과 스크린샷 색이 다르면 브라우저가 렌더링 뒤 색을 변환했을 가능성이 있습니다.</p>
          <button type="button" className={styles.refresh} onClick={() => setResult(getDiagnostic())}>색상 다시 측정</button>
          <pre data-force-dark-report>{JSON.stringify(result, null, 2)}</pre>
        </section>
        <p className={styles.notice}>
          실험용 정적 샘플입니다. 계정 로그인, 습관 저장, 실제 기록 변경 기능이 없습니다.
          삼성 인터넷의 강제 다크를 자동으로 감지하거나 차단했다고 주장하지 않습니다.
        </p>
      </div>
    </main>
  );
}
