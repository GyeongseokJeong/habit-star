---
name: design-guardian
description: 별하루 UI, UX, 카피, 테마, 시각 상태를 변경할 때 브랜드 감성과 직관적인 기록 경험을 보호한다. 데이터 전용이나 CI 전용 변경에는 사용하지 않는다.
---

# design-guardian

## 호출 조건 및 제외 조건

UI·카피·컴포넌트·테마 변경 때 호출한다. 화면과 무관한 DB·CI만 바꾸면 제외한다.

## 참조 문서

`docs/PRODUCT_PHILOSOPHY.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`.

## 실행 절차

기존 컴포넌트/스타일과 모바일·라이트·다크 화면을 확인한다. Starlit Warmth의 Surface(Navy/Ivory), Selection(Plum), Achievement(Gold), Growth(Sage)를 역할별로 사용하고 기존 변수를 일괄 교체하지 않는다. 신규 선택형 컨트롤에는 `--control-bg`/`--control-border`와 `--selection-bg`/`--selection-fg`를 적용한다. 채워진 선택 배경·굵기/경계/표시, `aria-pressed`(탭은 `aria-selected`), 44×44 터치·키보드 포커스를 확인한다. 이모지 원색과 별점 골드를 보존하고 프리셋·요일 선택을 동기화한다. 앱 테마가 OS 선호보다 우선하도록 모달·네이티브 입력의 `color-scheme`을 확인하며 Android 강제 다크 모드는 실기기에서 따로 검증한다. 선택·완료·오류를 설명 없이 구분하도록 설계하고 기존 컴포넌트를 재사용한다. 별빛과 격려 문구를 유지하면서 중복 카드·배너·토스트만 줄인다. 실제 화면과 관련 회귀를 확인한다.

## 금지 사항

감성 문구 일괄 삭제, 불필요한 모달/기록 단계 추가, 색상만으로 상태 표현 금지.

## 완료 기준

기록 조작이 간결하고 양쪽 테마·모바일에서 상태가 선명하며 기존 디자인과 일치한다.

## 실패 시 대응

불분명한 상태나 레이아웃 회귀를 재현하고 영향받은 UI만 수정해 다시 확인한다.

## 최종 결과 보고 형식

변경한 화면 / 유지한 브랜드 요소 / 화면 검증 결과 / 잔여 문제.
