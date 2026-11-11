---
name: accessibility-auditor
description: 별하루 UI/UX 변경 시 모바일 터치, 키보드, 포커스, 스크린리더 레이블, 대비, 반응형 상태와 오류 안내를 확인한다. UI가 없는 데이터/CI 변경에는 사용하지 않는다.
---

# accessibility-auditor

## 호출 조건 및 제외 조건

화면·상호작용 변경에 호출한다. UI가 없는 DB·CI 작업은 제외한다.

## 참조 문서

`docs/DESIGN_SYSTEM.md`, `docs/PRODUCT_PHILOSOPHY.md`, `docs/DEVELOPMENT_RULES.md`, `docs/COMPATIBILITY_TODO.md`.

## 실행 절차

모바일 44px 터치와 가로 스크롤을 확인한다. 탭/Enter/Space 조작과 `:focus-visible`을 점검한다. 버튼 이름·`aria-pressed`·오류/저장 상태의 음성 전달, 라이트·다크 대비, 확대·좁은 뷰포트를 살핀다. 가능한 브라우저 회귀와 수동 화면 검토를 함께 수행한다.

## Evidence Before CSS Changes

색상/대비 이상은 먼저 기기·OS 테마·브라우저 강제 다크 설정·앱 테마와 OFF/ON 상태를 기록한다. `docs/COMPATIBILITY_TODO.md`의 이전 수정·테스트를 검토하고 폼 컨트롤과 일반 HTML 요소가 다른지 확인하여 코드 결함과 브라우저 렌더링을 구분한다. CSS 변경 시 정상 Chrome의 대비·레이블·포커스 회귀도 확인한다. 실기기에서 재검증하지 못하면 그 범위를 명시하고 해결·접근성 통과를 선언하지 않는다.

## 금지 사항

색상 단독 상태 표시, 의미 없는 레이블, 자동 테스트만으로 접근성 통과 선언 금지. 근거 없는 CSS 우회 누적이나 Chromium 결과를 삼성 인터넷 실기기 결과로 대체하지 않는다.

## 완료 기준

핵심 기록 흐름을 키보드/터치로 완료하고 상태를 시각·보조기술로 알 수 있다.

## 실패 시 대응

재현한 기기·테마·조작과 실패 요소를 기록하고 관련 UI만 수정해 재검증한다.

## 최종 결과 보고 형식

화면·뷰포트 / 터치·키보드·레이블·대비 결과 / 미확인 항목.
