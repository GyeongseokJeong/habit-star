# 호환성 TODO — 삼성 인터넷 강제 다크 모드의 루틴 알림 스위치 색상

**상태: 버튼 기반 대안 적용 / 운영 실기기 재검증 대기** — A/B/C 비교에서 B·C의 개선을 관찰했으나, 운영 스위치 수정 후의 삼성 인터넷 결과와 정확한 브라우저 렌더링 원인은 아직 확인되지 않았다.

## 영향 환경과 재현

- 사용자 실기기 관찰: Android 휴대폰을 다크 모드로 설정하고 삼성 인터넷에서 별하루를 연다. 별하루 앱 자체의 라이트·다크 모드를 각각 선택하여 습관 추가/수정 화면의 루틴 알림 스위치 OFF/ON을 확인한다.
- 실제 관찰: 앱 테마 양쪽에서 스위치 트랙과 손잡이가 지나치게 어둡다. 시간대·요일 선택 버튼 같은 일반 컨트롤은 상대적으로 정상적인 플럼색을 유지한다. 이것이 모든 삼성 인터넷 버전에서 재현되는지는 모른다.
- 정상 확인(사용자 실기기 관찰): 휴대폰 라이트 모드에서는 별하루 색상이 정상이다. 휴대폰 다크 모드의 Chrome에서도 앱 라이트·다크 모드가 정상이다.
- 2026-11-11 사용자 제공 삼성 인터넷 스크린샷(`Screenshot_20261111_103823_Samsung Browser.jpg`): A는 ON인데 트랙이 지나치게 어둡다. B(`button` + span 손잡이)는 ON에서 플럼색 트랙, C(`button` + `::after`)는 OFF에서 중립색 트랙으로 보인다. 사용자가 B와 C의 ON/OFF 색이 동일하게 정상이라고 확인하여 각각 B=ON, C=OFF로 촬영했다. 이 사진 한 장만으로 각 앱 테마·OS 테마 조합이나 두 구조의 다른 상태를 모두 검증했다고 간주하지 않는다.
- 미기록 환경: 기기 모델, Android/One UI/삼성 인터넷 버전, 삼성 인터넷의 웹페이지 다크 모드·강제 다크 설정 값. 화면 캡처만으로 CSS 계산색이나 브라우저 내부 처리 원인을 단정하지 않는다.

## 원인 가설과 기존 변경의 범위

삼성 인터넷의 웹페이지 강제 다크 모드나 브라우저 자체 색상 변환이 유력하지만, 해당 설정의 활성 여부와 정확한 렌더링 원인은 **확정되지 않았다**. OS 테마, 브라우저 강제 다크, 앱 테마는 별개다. 스위치와 일반 선택 버튼의 차이는 네이티브 폼 컨트롤과 HTML 요소/스타일 계층의 처리 차이를 조사할 단서이지 원인 증명이 아니다.

현재 `main`에서 확인한 사실:

- `9711d16`은 스위치 트랙 56×32px, 손잡이 24px, 이동 24px 및 터치 영역 회귀를 수정했다.
- `c5cd8a8`은 두 화면의 스위치를 공통 `ReminderToggle`로 묶고, 숨긴 checkbox와 HTML 트랙/손잡이를 분리했다. `app/globals.css`에서 OFF/ON 색, `color-scheme: only light`, `:focus-visible`, `@media (forced-colors: active)` 스타일을 지정한다. 이 코드가 삼성 인터넷의 강제 다크 변환을 막는다는 증거는 없다.
- `tests/e2e/starlit-warmth.spec.ts`는 Chromium에서 320/395px, 라이트/다크, OFF/ON 위치·색, 저장 후 상태, 키보드, reduced motion 및 forced-colors를 확인한다. Chromium 테스트나 GitHub CI 통과는 삼성 인터넷 실기기 검증을 대체하지 않는다.

## Habit Experience 2.1 당시 확인 범위

이전 조사에서는 당시 공통 `ReminderToggle`의 네이티브 checkbox와 별도 HTML 트랙/손잡이 구조를 재확인했다. 당시 CSS에 새 색상 우회를 더하지 않았다. Chromium의 OFF/ON 이동, 포커스, 저장 상태, forced-colors와 OS/앱 라이트·다크 조합 자동 회귀는 통과했다. 그 시점에는 삼성 인터넷 실기기 및 웹페이지 강제 다크 설정을 검증할 수 없어 **Deferred / Unresolved**로 기록했다. 브라우저 캐시나 서비스 워커의 구버전 CSS 적용 가능성 역시 실기기에서 버전/설정을 대조해야 분리할 수 있다.

## 운영 스위치 실기기 재검증

문제가 보이는 삼성 인터넷 탭을 USB 디버깅이 켜진 기기에서 열고, PC Chrome의 `chrome://inspect/#devices`에서 해당 탭의 **Inspect**를 선택한다. 운영 앱의 새 습관 추가/수정 모달을 연 뒤 DevTools Console에 아래 코드를 붙여 넣는다. 습관 이름·계정·토큰은 수집하지 않는다. 각 조건에서 **OFF와 ON을 각각** 실행하고, 동일 기기의 Chrome에서도 같은 조건을 반복하여 결과와 화면 캡처를 함께 보존한다. 디버깅 도구에 연결할 수 없다면 기기 모델·Android/One UI/삼성 인터넷 버전, OS 다크 및 삼성 인터넷의 웹페이지 다크 모드 설정, 앱 테마, OFF/ON 스크린샷을 먼저 요청한다.

```js
(() => {
  const dialog = document.querySelector("dialog[open]");
  const toggle = dialog?.querySelector(".reminder-switch");
  if (!toggle) {
    console.warn("습관 추가/수정 모달을 먼저 열어 주세요.");
    return;
  }
  const elements = {
    dialog,
    switchTrack: toggle,
    switchThumb: toggle.querySelector(".reminder-switch-thumb"),
    selectedTime: dialog.querySelector(".segmented button.selected"),
    selectedWeekday: dialog.querySelector(".repeat-weekdays button.selected"),
  };
  console.log("switch environment", {
    browser: navigator.userAgent,
    forcedColors: matchMedia("(forced-colors: active)").matches,
    osDark: matchMedia("(prefers-color-scheme: dark)").matches,
    appDark: document.querySelector(".byeolharu")?.classList.contains("dark"),
    checked: toggle.getAttribute("aria-checked"),
    selectionToken: getComputedStyle(dialog)
      .getPropertyValue("--selection-bg")
      .trim(),
  });
  console.table(
    Object.fromEntries(
      Object.entries(elements).map(([name, element]) => {
        const css = getComputedStyle(element);
        return [
          name,
          {
            colorScheme: css.colorScheme,
            background: css.backgroundColor,
            foreground: css.color,
            forcedColorAdjust: css.forcedColorAdjust,
            filter: css.filter,
            opacity: css.opacity,
          },
        ];
      }),
    ),
  );
})();
```

현재 운영 스위치는 B 구조의 `button[role=switch]`와 내부 손잡이로, 기존의 보이는 트랙 56×32px·손잡이 24×24px·터치 영역 56×44px를 유지하며 앱 테마의 `color-scheme`을 상속한다. 기존 A 구조의 checkbox와 `color-scheme: only light`는 개발용 진단 화면에만 남는다. 트랙/손잡이는 일반 모드에서 `--toggle-off`/`--selection-bg` 및 `#fff`를 사용하고 `forced-colors: active`에서 시스템 색을 사용한다. 브라우저 강제 다크 설정과 CSS `forced-colors` 미디어 쿼리가 동일하다고 가정하지 않는다.

판정: 쿼리가 `true`이고 시스템 색으로 계산되면 접근성용 고대비 분기의 영향이다. `false`인데 트랙/손잡이 계산색이 시간대·요일과 달리 의도와 다르면 적용된 CSS/캐시/토큰을 조사한다. 계산색은 정상인데 실제 픽셀만 어두우면 브라우저의 페인트 후처리 가능성을 조사한다. `getComputedStyle()`은 후처리된 픽셀 색을 증명하지 못하므로 화면 캡처와 반드시 함께 비교한다. **운영 화면의 실기기 재검증 전에는 원인도 해결도 확정하지 않는다.**

## 세 구조 비교 (실기기 A/B/C 판정 완료, 운영 재검증 대기)

개발 서버 전용 `/diagnostics/switch`에서 A(이전 checkbox + span 트랙/손잡이), B(`button[role=switch]` + span 손잡이), C(`button[role=switch]` + `::after` 손잡이)를 동일한 `--toggle-off`, `--selection-bg` 토큰으로 표시한다. 시간대·요일 선택 버튼도 함께 두고 브라우저가 계산한 `background`, `color-scheme`, `forced-color-adjust`, `filter`, `opacity`, OS/앱 테마 및 `forced-colors`를 화면에 출력한다. 각 버튼을 눌러 OFF/ON을 각각 촬영한다. A는 수정 전 운영 DOM/CSS를 그대로 재현하며 현재 운영 `ReminderToggle`은 B 구조다. 진단 화면의 B/C는 버튼 자체가 56×44px 트랙이지만 운영 B는 56×44px 클릭 영역 내부의 트랙이 56×32px로 보이도록 유지한다. 진단 A도 56×44px 클릭 영역 내부 56×32px 트랙이다. 서로 다른 트랙 높이를 감안한다. 운영 빌드에서 이 경로는 404를 반환하며 앱의 탐색 메뉴에 노출되지 않는다.

삼성 인터넷에서 OS 라이트/다크 × 앱 라이트/다크 × OFF/ON을 기록하고 같은 기기의 Chrome과 비교한다. OS 설정을 바꿨다면 페이지를 새로고침하거나 **OS 설정 변경 후 다시 측정**을 누른다. 캡처에는 스위치 3종과 선택 버튼, 측정 JSON을 함께 넣는다. 계산색이 정상이어도 페인트 후처리로 실제 픽셀이 다를 수 있어 둘 다 필요하다. 삼성 인터넷에서 A만 어둡게 표시되고 B/C가 정상으로 보인다는 사용자 실기기 확인에 따라, 공통 운영 스위치에는 내부 손잡이가 명시된 B를 채택한다. A 비교 코드는 이 페이지에만 남겨둔다. 구조 차이가 색상 변환에 영향을 준다는 증거는 있으나 정확한 삼성 인터넷 내부 원인까지 확정된 것은 아니다. 운영 적용 후 두 앱 테마와 OFF/ON을 다시 확인하기 전에는 해결로 종결하지 않는다.

## 후속 검증과 완료 기준

1. 문제 기기의 OS/One UI/삼성 인터넷 버전, 브라우저 웹페이지 다크 모드 설정, 앱 테마 및 재현 시각을 기록한다. 가능한 경우 동일 화면의 OFF/ON 스크린샷과 설정 값을 보존한다.
2. 동일 기기에서 OS 라이트·다크 × 삼성 인터넷 웹페이지 다크 모드 ON/OFF × 앱 라이트·다크를 비교하고, Chrome의 같은 조건을 대조한다. 어떤 조건에서 트랙/손잡이가 왜곡되는지 재현한다.
3. 운영 모달의 버튼 트랙·손잡이와 시간대·요일 버튼의 계산된 스타일/실제 표시를 비교하고, 진단 화면의 이전 checkbox 구조 A도 대조한다. 브라우저 변환과 앱 CSS 중 원인을 증거로 분리한다.
4. B 기반 운영 스위치의 저장·수정 흐름, 키보드·포커스·스크린리더 상태·터치·고대비, Chrome 양쪽 테마 및 Chromium 자동 회귀를 확인한다. 동일 증상에 CSS 우회를 누적하지 않는다.
5. **Closed 판정:** 수정된 운영 화면을 문제 기기의 삼성 인터넷에서 다시 열어 OS 다크 모드의 앱 양쪽 테마에서 OFF/ON 트랙과 손잡이가 의도한 대비인지 확인한다. OS 라이트와 Chrome에서도 회귀가 없고 관련 자동 테스트가 통과해야 한다. 운영 코드의 실기기 재검증이나 재현 조건 기록이 빠졌다면 미해결로 둔다.

상태 전환은 [개발 규칙](DEVELOPMENT_RULES.md)의 증거 단계에 따른다. 디자인 판단은 [디자인 시스템](DESIGN_SYSTEM.md)을 따른다.
