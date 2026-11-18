"use client";

import { Bell } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./switch-comparison.module.css";

type Variant = "A" | "B" | "C";
type Palette = "current" | "refined" | "refined2";
const variants: { id: Variant; title: string; structure: string }[] = [
  {
    id: "A",
    title: "이전 구현",
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
    backgroundImage: css.backgroundImage,
    foreground: css.color,
    colorScheme: css.colorScheme,
    forcedColorAdjust: css.forcedColorAdjust,
    filter: css.filter,
    opacity: css.opacity,
  };
}

function capture(checked: Record<Variant, boolean>, theme: "light" | "dark", palette: Palette) {
  const root = document.querySelector("[data-switch-diagnostics]")!;
  const selectedTime = root.querySelector("[data-selected-time]")!;
  const selectedWeekday = root.querySelector("[data-selected-weekday]")!;
  const samples = [
    "page",
    "surface",
    "body-text",
    "plain-button",
    "primary-button",
    "disabled-button",
    "disabled-date",
    "gradient",
    "artwork",
    "modal",
    "modal-input",
  ];
  return {
    environment: {
      browser: navigator.userAgent,
      osDark: matchMedia("(prefers-color-scheme: dark)").matches,
      forcedColors: matchMedia("(forced-colors: active)").matches,
      appTheme: theme,
      palette,
      documentScheme: getComputedStyle(document.documentElement).colorScheme,
      appScheme: getComputedStyle(root).colorScheme,
      metaColorScheme:
        document
          .querySelector('meta[name="color-scheme"]')
          ?.getAttribute("content") ?? null,
      themeColor:
        document
          .querySelector('meta[name="theme-color"]')
          ?.getAttribute("content") ?? null,
      tokens: Object.fromEntries(
        [
          "--bg",
          "--surface",
          "--ink",
          "--soft",
          "--gold",
          "--selection-bg",
        ].map((name) => [
          name,
          getComputedStyle(root).getPropertyValue(name).trim(),
        ]),
      ),
      selectionToken: getComputedStyle(root)
        .getPropertyValue("--selection-bg")
        .trim(),
    },
    samples: Object.fromEntries(
      samples.map((name) => [
        name,
        getColors(
          name === "page"
            ? root
            : root.querySelector(`[data-color-sample="${name}"]`)!,
        ),
      ]),
    ),
    matrix: Object.fromEntries(
      Array.from({ length: 6 }, (_, tier) => [
        `tier-${tier}`,
        getColors(root.querySelector(`[data-matrix-tier="${tier}"]`)!),
      ]),
    ),
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
  const [palette, setPalette] = useState<Palette>("current");
  const [checked, setChecked] = useState<Record<Variant, boolean>>({
    A: false,
    B: false,
    C: false,
  });
  const [report, setReport] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReport(JSON.stringify(capture(checked, theme, palette), null, 2));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [checked, theme, palette, refresh]);

  const toggle = (id: Variant) =>
    setChecked((current) => ({ ...current, [id]: !current[id] }));

  return (
    <main
      data-switch-diagnostics
      data-color-sample="page"
      className={`byeolharu ${theme === "dark" ? "dark" : ""} ${styles.page} ${palette === "refined" ? styles.refined : palette === "refined2" ? styles.refined2 : ""}`}
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>별하루 · 개발 진단 전용</p>
          <h1>브라우저 색상 A/B/B2 비교</h1>
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
          <div className={styles.palettePicker} aria-label="진단 화면 팔레트 선택">
            {([
              { id: "current", label: "A · 현재" },
              { id: "refined", label: "B · 대비 개선" },
              { id: "refined2", label: "B2 · 가독성 강화" },
            ] as const).map(({ id, label }) => (
              <button
                type="button"
                key={id}
                className={styles.themeButton}
                aria-pressed={palette === id}
                onClick={() => setPalette(id)}
                data-palette-option={id}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <section aria-labelledby="palette-ab-title" className={styles.panel}>
          <h2 id="palette-ab-title">다크 팔레트 A/B/B2 미리보기</h2>
          <p>
            A는 현재 색상, B는 이미 실기기에서 조금 더 낫다고 평가된 개선안입니다. B2는 B에서 날짜·별점 대비만 추가 조정한 후보입니다.
            같은 삼성 인터넷 다크 설정에서 두 카드를 비교하세요.
          </p>
          <div className={styles.paletteCompare}>
            {([
              { id: "current", label: "A · 현재 다크" },
              { id: "refined", label: "B · 개선 후보" },
              { id: "refined2", label: "B2 · 가독성 강화" },
            ] as const).map(({ id, label }) => (
              <div
                key={id}
                data-palette-preview={id}
                className={`${styles.palettePreview} ${id === "refined2" ? styles.palettePreviewRefined2 : id === "refined" ? styles.palettePreviewRefined : styles.palettePreviewCurrent}`}
              >
                <p className={styles.palettePreviewTitle}>{label}</p>
                <div className={styles.palettePreviewPanel}>
                  <p className={styles.palettePreviewHeading}>별점 매트릭스</p>
                  <p className={styles.palettePreviewMonth}>2026년 11월</p>
                  <div className={styles.palettePreviewDates} aria-label={`${label} 0~5점 및 비활성 색상`}>
                    {Array.from({ length: 6 }, (_, tier) => (
                      <span
                        key={tier}
                        className={styles.palettePreviewDay}
                        data-preview-tier={tier}
                        aria-label={`${tier}점 색상`}
                      >
                        {tier + 10}
                      </span>
                    ))}
                    <span className={styles.palettePreviewDay} data-preview-tier="disabled" aria-label="비활성 날짜 색상">16</span>
                  </div>
                  <div className={styles.palettePreviewControls}>
                    <span className={styles.palettePreviewSelected}>별점 선택</span>
                    <span className={styles.palettePreviewQuiet}>미선택</span>
                  </div>
                  <p className={styles.palettePreviewFootnote}>하나의 별이 모여, 나만의 우주가 돼요.</p>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.paletteDisclaimer}>
            위의 선택 버튼은 아래 진단 요소에만 임시 적용됩니다. B/B2는 앱 다크 모드에서만 차이가 나며
            실제 사용자 화면의 CSS와 기록은 변경되지 않습니다.
          </p>
        </section>
        <section
          aria-labelledby="palette-title"
          className={styles.panel}
          data-color-sample="surface"
        >
          <h2 id="palette-title">화면 색상 기준</h2>
          <p data-color-sample="body-text">
            배경·본문·별점 날짜가 앱 테마에 맞게 보이는지 확인하세요.
          </p>
          <div
            className={styles.matrix}
            aria-label="별점 매트릭스 색상 0점부터 5점"
          >
            {Array.from({ length: 6 }, (_, tier) => (
              <div key={tier} className={styles.matrixCell}>
                <span className={styles.matrixLabel}>{tier}점</span>
                <button
                  type="button"
                  className={`day-tile tier-${tier}`}
                  data-matrix-tier={tier}
                  aria-label={`${tier}점 날짜 색상 샘플`}
                >
                  {tier + 10}
                </button>
              </div>
            ))}
            <div className={styles.matrixCell}>
              <span className={styles.matrixLabel}>비활성</span>
              <button
                type="button"
                className="day-tile tier-0"
                data-color-sample="disabled-date"
                aria-label="비활성 날짜 색상 샘플"
                disabled
              >
                16
              </button>
            </div>
          </div>
          <div className={styles.references}>
            <button
              type="button"
              className={styles.themeButton}
              data-color-sample="plain-button"
            >
              일반 버튼
            </button>
            <button
              type="button"
              className="primary"
              data-color-sample="primary-button"
            >
              주요 버튼
            </button>
            <button
              type="button"
              className={styles.themeButton}
              data-color-sample="disabled-button"
              disabled
            >
              비활성 버튼
            </button>
          </div>
          <div className={styles.visualSamples}>
            <div className="little-note" data-color-sample="gradient">
              별하루 그라디언트
            </div>
            <figure>
              <Image
                src="/assets/constellation/stage-06.webp"
                alt="승인된 6단계 별자리: 금빛 뿔의 별빛 사슴"
                width={100}
                height={150}
                data-color-sample="artwork"
              />
              <figcaption>승인된 6단계 원화</figcaption>
            </figure>
          </div>
          <dialog
            open
            className={`modal ${styles.modalSample}`}
            data-color-sample="modal"
            aria-label="모달 색상 샘플"
          >
            <p>모달 배경과 입력 필드</p>
            <label className="field">
              <span>진단용 입력</span>
              <input
                data-color-sample="modal-input"
                type="text"
                placeholder="입력 색상 확인"
              />
            </label>
          </dialog>
        </section>
        <section aria-labelledby="reference-title" className={styles.panel}>
          <h2 id="reference-title">스위치·선택 버튼 기준</h2>
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
