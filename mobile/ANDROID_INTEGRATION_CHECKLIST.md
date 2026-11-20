# Android 통합 후보 검토표 — STEP 22

> 본 문서는 `app/main` 병합 전 심사용입니다. 테스트 APK, 기존 Android 앱의 저장 기록, 운영 `main`/Supabase를 변경하지 않습니다. **Draft PR 생성은 병합 승인이 아닙니다.**

## 통합 대상

- 기준: `app/main`
- 후보: `app/integration/android-guest-candidate-step22` (STEP 21 검증 완료 브랜치 기반)
- 현재까지의 작업은 하나의 선형 Android 스택이며 개별 PR 병합은 아직 수행되지 않았습니다.
- 선행 Draft PR의 하위 의존 순서: `#67 → #74 → #76 → #77 → #78 → #81 → #83 → #86 → #89 → #90 → #92 → #95 → #97 → #99 → #100 → #102 → #104 → #106 → #108 → #111 → #112`.

## 검증 근거

- STEP 15: 갤럭시 실제 알림 수신 및 완료/취소·시간 변경·재실행·전체 OFF 테스트 성공.
- STEP 16: 갤럭시 재부팅 전후 수신/예약 복구 및 OS 권한 차단/재허용 테스트 성공.
- STEP 21: 갤럭시 OS 권한 차단→토글 OFF→다시 ON 설정 이동→허용 후 ON 복구→기존 기록/예약 유지, 4개 성공.
- STEP 21 GitHub Actions: Android 빌드 6개, 일반 verify 2개, Supabase cloud 2개 성공.
- STEP 20: `app/main` 대비 전체 Android 변경 경로 자동 검사 성공.
- STEP 21: 웹/Android 공유 파일 7개 직접 검토 후 `components/byeolharu.tsx` 예정 시간 비우기 동작을 native 전용으로 제한하고 회귀 테스트 추가.

## `app/main` 대비 공유 파일 7개 (병합 심사 대상)

| 경로 | 변경 취지 | 병합 전 확인 |
| --- | --- | --- |
| `app/globals.css` | 편집 UI 버튼 최소 터치 영역 44px | 웹 디자인 유지·접근성 |
| `components/account/account-panel.tsx` | Android에서만 알림·권한/진단 UI 노출 | 일반 웹에서는 비노출 |
| `components/byeolharu.tsx` | Android 예약 설정 prop과 습관 편집 처리 | 예정 시간 입력 기존 웹 동작 불변 |
| `lib/habits/native-reminder-controls.ts` | Android용 타입 계약 | 런타임 의존성 없음 |
| `lib/habits/use-habit-app.ts` | native resume 이벤트 지원/정리 | 브라우저 갱신 정상·리스너 정리 |
| `tests/e2e/habit-editor-balanced.spec.ts` | 터치 영역 소수점 측정 보정 | 320/390/430px E2E |
| `tsconfig.json` | Android PoC를 Next.js 타입 빌드에서 제외 | 웹 타입 체크 유지 |

## 병합 승인 조건

- [x] Android 기능 통합 소스/PR 의존성 확인
- [x] 알림 기본 동작 및 기기 설정 전환 실기기 검증
- [x] STEP 20 경로 제한 및 STEP 21 공유 파일 점검
- [ ] 통합 후보 PR 자체의 최신 CI 전부 성공 확인
- [ ] 통합 후보 PR에 새로 올라오는 리뷰 및 코드 충돌 재점검
- [ ] 운영 웹 비영향 및 기존 Android 테스트 데이터 유지에 대한 최종 승인
- [ ] 사용자의 명시적 `app/main` 병합 승인

## 병합 방식 선택 시 주의

이 후보 PR은 누적 Android 스택 **전체 차이**를 `app/main`에 한 번에 보여주기 위한 검토용입니다. 따라서 후보 PR과 개별 단계 PR을 모두 병합하면 중복·이력 혼란이 생길 수 있습니다. 둘 중 **하나의 병합 방식**을 결정해야 합니다.

1. **단일 통합 PR 방식(권장):** 최종 후보만 `app/main`에 승인 후 병합하고, 선행 Draft PR은 병합하지 않은 채 superseded/closed 처리합니다. 최초 심사와 회귀테스트는 전체 diff에 집중합니다.
2. **개별 스택 병합:** `#67`부터 `#112`까지 정확한 의존 순서로 병합하되, 각 단계에서 후속 PR의 base와 diff 변화를 재확인합니다. 이력 보존에 유리하지만 단계가 많고 관리 부담이 큽니다.

**금지:** `main` 운영 웹에 직접 병합, 기존 테스트 APK 패키지 삭제/변경, 사용자 기록 삭제, 릴리스 AAB 서명/Play 업로드, Supabase 배포. 위 결정/승인이 있을 때까지 Draft 유지.
