"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./switch-comparison.module.css";

type Variant = "A" | "B" | "C";
const variants: { id: Variant; title: string; structure: string }[] = [
  {
    id: "A",
    title: "현재 구현",
    structure: "checkbox + span 트랙 + span 손잡이",
  },
  {
    id: "B",
    title: "버튼과 내부 요소",
    structure: "button[role=switch] + span 손잡이",
  },
  {
    id: "C",
    title: "버튼과 가상 요소",
    structure: "button[role=switch] + ::after 손잡이",
  },
];

function getColors(element: Element, pseudo?: string) {
  const css = getComputedStyle(element, pseudo);
  return {
    background: css.backgroundColor,
    foreground: css.color,
    colorScheme: css.colorScheme,
    forcedColorAdjust: css.forcedColorAdjust,
    filter: css.filter,
    opacity: css.opacity,
  };
}

function capture(checked: Record<Variant, boolean>, theme: "light" | "dark") {
  const root = document.querySelector("[data-switch-diagnostics]")!;
  const selectedTime = root.querySelector("[data-selected-time]")!;
  const selectedWeekday = root.querySelector("[data-selected-weekday]")!;
  return {
    environment: {
      browser: navigator.userAgent,
      osDark: matchMedia("(prefers-color-scheme: dark)").matches,
      forcedColors: matchMedia("(forced-colors: active)").matches,
      appTheme: theme,
      selectionToken: getComputedStyle(root)
        .getPropertyValue("--selection-bg")
        .trim(),
    },
    selectedTime: getColors(selectedTime),
    selectedWeekday: getColors(selectedWeekday),
    switches: Object.fromEntries(
      variants.map(({ id }) => {
        const sample = root.querySelector(`[data-variant="${id}"]`)!;
        const track = sample.querySelector("[data-track]")!;
        const thumb = sample.querySelector("[data-thumb]");
        return [
          id,
          {
            checked: checked[id],
            track: getColors(track),
            thumb: getColors(thumb ?? track, thumb ? undefined : "::after"),
          },
        ];
      }),
    ),
  };
}

export default function SwitchComparison() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [checked, setChecked] = useState<Record<Variant, boolean>>({
    A: false,
    B: false,
    C: false,
  });
  const [report, setReport] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReport(JSON.stringify(capture(checked, theme), null, 2));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [checked, theme, refresh]);

  const toggle = (id: Variant) =>
    setChecked((current) => ({ ...current, [id]: !current[id] }));

  return (
    <main
      data-switch-diagnostics
      className={`byeolharu ${theme === "dark" ? "dark" : ""} ${styles.page}`}
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>별하루 · 개발 진단 전용</p>
          <h1>스위치 색상 비교</h1>
          <p>
            운영 스위치는 변경하지 않습니다. 같은 선택 토큰으로 세 가지 DOM
            구조를 비교합니다. 실제 색은 화면 캡처와 아래 계산색을 함께 확인해
            주세요.
          </p>
          <button
            type="button"
            className={styles.themeButton}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`앱 ${theme === "light" ? "다크" : "라이트"} 모드로 전환`}
          >
            앱 테마: {theme === "light" ? "라이트" : "다크"}
          </button>
        </header>
        <section aria-labelledby="reference-title" className={styles.panel}>
          <h2 id="reference-title">정상 표시 기준</h2>
          <div className={styles.references}>
            <div className="segmented">
              <button
                data-selected-time
                className="selected"
                type="button"
                aria-pressed="true"
              >
                아침
              </button>
            </div>
            <div className="repeat-weekdays">
              <button
                data-selected-weekday
                className="selected"
                type="button"
                aria-label="월요일"
                aria-pressed="true"
              >
                월
              </button>
            </div>
          </div>
        </section>
        <section
          aria-labelledby="comparison-title"
          className={styles.comparison}
        >
          <h2 id="comparison-title">A / B / C 구조 비교</h2>
          <div className={styles.samples}>
            {variants.map(({ id, title, structure }) => (
              <div className={styles.panel} data-variant={id} key={id}>
                <h3>
                  {id}. {title}
                </h3>
                <p className={styles.structure}>{structure}</p>
                {id === "A" ? (
                  <label className="alarm-field">
                    <span>
                      <Bell size={16} /> 루틴 알림 A
                    </span>
                    <span className="toggle-control">
                      <input
                        className="toggle-input"
                        type="checkbox"
                        checked={checked.A}
                        onChange={(event) =>
                          setChecked((current) => ({
                            ...current,
                            A: event.target.checked,
                          }))
                        }
                      />
                      <span
                        data-track
                        className="toggle-track"
                        aria-hidden="true"
                      >
                        <span data-thumb className="toggle-thumb" />
                      </span>
                    </span>
                  </label>
                ) : (
                  <div className="alarm-field">
                    <span>
                      <Bell size={16} /> 루틴 알림 {id}
                    </span>
                    <button
                      data-track
                      type="button"
                      role="switch"
                      aria-label={`루틴 알림 ${id}`}
                      aria-checked={checked[id]}
                      className={`${styles.buttonTrack} ${id === "C" ? styles.pseudo : ""} ${checked[id] ? styles.on : ""}`}
                      onClick={() => toggle(id)}
                    >
                      {id === "B" ? (
                        <span
                          data-thumb
                          className={styles.thumb}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  </div>
                )}
                <p className={styles.state}>
                  상태: {checked[id] ? "ON" : "OFF"}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section aria-labelledby="measure-title" className={styles.panel}>
          <div className={styles.measureHeading}>
            <h2 id="measure-title">계산된 스타일</h2>
            <button
              type="button"
              className={styles.themeButton}
              onClick={() => setRefresh((value) => value + 1)}
            >
              OS 설정 변경 후 다시 측정
            </button>
          </div>
          <p>
            OS/브라우저 웹페이지 다크 설정 · 앱 테마를 기록하고, OFF와 ON을 각각
            캡처하세요. 계산색은 브라우저의 페인트 후처리를 보여주지 않습니다.
          </p>
          <pre data-diagnostic-report className={styles.report}>
            {report}
          </pre>
        </section>
      </div>
    </main>
  );
}
