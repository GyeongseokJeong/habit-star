# Android 통합 후 정리 목록 — 2026-11-21

## 이번 변경에서 정리
- `mobile/scripts/check-integration-scope.mjs` 및 테스트: 과거 `app/main` 스택을 비교하던 임시 검사로, PR #120에서 단일 `main` 개발 체계로 통합했으므로 제거
- Android Actions: 6개 디버그 빌드를 모든 PR에서 실행하던 방식에서 검증 대상 1개를 기본으로 전환. 5개 레거시 작업은 수동 `legacy_diagnostics` 옵션으로 보존
- 빌드 추적: Android APK와 함께 소스 SHA·버전·cloudEnabled=false가 담긴 `build-info.json`을 업로드. 웹·Android 설정 화면에서 빌드 정보 확인
- `mobile/package.json`의 낡은 통합 scope 검사 실행 항목 제거

## 추후 단계에서 재검토 (이번에는 삭제하지 않음)
- `app/main` 및 20여 개 과거 Android 브랜치: 모두 과거 단계의 이력으로, PR 재사용/미반영 커밋/재현 필요성을 확인하기 전에는 삭제하지 않음
- 과거 WebView/알림 데모 JS, HTML, Java 템플릿과 실행 스크립트: 별도 PoC 회귀 원인 추적에 사용될 수 있어 잠정 보존
- `mobile/README.md`의 STEP 기록: 재현 근거를 지키되 현재 지침과 명확히 분리
- 플레이스토어 정식 앱 ID, 안정된 서명, 영구 Android 프로젝트, 데이터 이전: 이번 범위 밖

## 삭제 전 확인 기준
1. 사용 중인 빌드 스크립트·테스트·GitHub workflow에 참조가 없는지 검사
2. 과거 실기기 확인 또는 이슈 재현에 꼭 필요한 증빙이 아닌지 확인
3. 기존 APK applicationId/서명/IndexedDB 및 알림 예약에 영향이 없는지 확인
4. 분리 PR에서 CI 통과 후 정리 (브랜치는 별도 동의 후 삭제)

이 정리는 운영 웹 배포, Supabase Auth/DB/RLS, 사용자 로컬 데이터를 직접 수정하지 않습니다.

## 2026-11-21 후속 정리: 레거시 독립 PoC 제거
- 현행 APK에 불필요한 standalone Android CI 작업 5개 및 `legacy_diagnostics` 수동 옵션 제거
- 사용되지 않는 실험용 화면 3종(단순 알림, STEP 5, STEP 8) HTML/JS 6개 파일 제거
- 해당 앱 전용 `prepare-notification-poc.mjs`, `check-webview-origin.mjs`, `check-notifications.test.mjs` 제거
- **유지**: 현재 packaged guest 진입점, native MainActivity/권한 연결, reminder-plan 및 lifecycle 등 공유 알림 런타임, 실제 기능 회귀 테스트
- **유지**: 현재 APK의 `packagedgueststep9` applicationId, 서명 방식, 데이터·알림 예약 정책
- 후속 정리 후보: Capacitor 구성의 실험 모드 분기, fallback placeholder 및 구형 문서 (테스트 영향 평가 후 별도 PR)
