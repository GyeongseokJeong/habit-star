# 개발·검증·배포 규칙

## 흐름과 검증 범위

Analyze(코드·호출 경로·영향 확인) → Design(철학·기존 UI·데이터 불변식) → Implement(최소 변경) → Validate(관련 테스트·호환성) → Review(스킬 완료 기준·잔여 위험). 실패한 테스트를 삭제하거나 설명 없이 건너뛰지 않는다. 스킬 파일 자체는 `pnpm validate:skills`로 확인한다.

| 변경 범위          | 필수 검증 출발점                                          | 추가 확인                                                                                         |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 문서/스킬          | `pnpm validate:skills`, `pnpm typecheck`, `pnpm test`     | GitHub CI, 참조 경로·시나리오                                                                     |
| UI/기능            | `pnpm typecheck`, `pnpm test`, 관련 `pnpm test:e2e`       | 실제 모바일/테마/키보드 화면, 필요하면 `pnpm build`와 `pnpm test:e2e:production`                  |
| 데이터/인증/동기화 | 위 검사 + `pnpm test:db --postgres`                       | 실제 로컬 Supabase 환경에서 `pnpm test:db`, `pnpm test:e2e:cloud`; 기존 데이터·오프라인·계정 격리 |
| 배포               | `pnpm build`, `pnpm test:e2e:production`, CI verify/cloud | 운영 백업·복구·PWA·환경변수 확인, 기존 v0.app Publish 유지                                        |

## Vercel 연동과 PR 품질 검사

- GitHub Actions `CI / verify`, `CI / cloud`는 PR 및 `main`에서 그대로 실행하며 코드 품질의 기준으로 유지한다. GitHub Actions 자체에는 Vercel 배포 검사가 없다.
- 루트 `vercel.json`의 `git.deploymentEnabled`에서 `main`만 자동 배포하고 다른 브랜치의 Preview 자동 배포는 중단한다. `main`이 Vercel 프로젝트의 Production Branch인지 프로젝트별로 확인한다. v0.app의 Publish 및 수동 배포 동작은 이 설정만으로 보장되지 않으며 별도로 확인한다.
- 배포 플랫폼의 `Vercel – habit-star`, `Vercel – habit-star-pwa-development` 상태는 GitHub Actions 검사가 아니라 Vercel GitHub 연동에서 발행한 외부 상태다. GitHub Branch protection에 필수 검사로 지정돼 있다면 저장소 관리자가 해당 두 검사만 해제해야 한다. 이 변경은 `vercel.json` 또는 CI YAML로 대신할 수 없다.
- 개발용 Vercel 프로젝트가 같은 저장소의 `main`에도 반응한다면 프로젝트 Git 연결/Production Branch 설정에서 불필요한 중복 자동 배포를 별도로 제한한다. 저장소의 단일 `vercel.json`은 프로젝트마다 다른 배포 정책을 독립 지정하지 못한다.
- `vercel.json` 정책이 실제 연동 프로젝트에 적용됐는지 Preview 브랜치와 `main` 각각에 대해 새 커밋 시 확인한다. 오래된 실패 상태는 자동으로 삭제되지 않는다. Vercel 상태가 여전히 PR에 발생하면 Vercel 프로젝트 Git 설정을 다시 확인한다. CI 실패를 가리거나 필수 검사를 무작정 비활성화하지 않는다.

## 브라우저 호환성 증거 절차

호환성 문제는 **Unresolved → Reproduced → Root Cause Confirmed → Fixed → Device Verified → Closed** 순으로 관리한다. Deferred는 해결 상태가 아니라 작업 우선순위 표시다. 각 단계는 기기·OS/브라우저 버전과 강제 다크 설정·앱 테마, 재현 증거, 이전 수정 이력, 코드/브라우저 원인 비교, 수정 커밋과 회귀 테스트, 해당 실기기의 수정 후 결과를 근거로 전환한다. 원인 가설만으로 Root Cause Confirmed/Fixed/Closed로 옮기지 않는다. 실기기를 구할 수 없다면 Device Verified/Closed로 옮기지 않는다.

**Evidence Before CSS Changes:** 재현 환경을 식별하고 앱 CSS와 브라우저 렌더링 원인을 구분한 뒤 이전 시도를 확인한다. 근거 없이 동일 문제에 CSS 우회를 누적하지 않는다. 변경 시 Chrome 등 정상 브라우저의 기존 UI 회귀를 검증하고 결과/미확인 조건을 [호환성 TODO](COMPATIBILITY_TODO.md)에 기록한다. 삼성 인터넷 스위치 건은 현재 Deferred / Unresolved이며 해결 완료로 취급하지 않는다.

`pnpm test:db --postgres`는 Docker/테스트 PostgreSQL이 필요하며 Auth HTTP 서버를 대체 검사하지 않는다. `pnpm test:db`와 `pnpm test:e2e:cloud`는 로컬 Supabase 스택이 실행 중이어야 한다. `pnpm test:e2e`/`pnpm test:e2e:production`은 Chromium 설치가 필요하며 설정된 개발/프로덕션 웹 서버를 사용한다. 실행 불가 환경은 통과로 표시하지 말고 원인을 기록한다. 기존 CI 결과는 기준선 SHA·실패 단계로 구분한다. DB 변경은 운영 마이그레이션 재실행·초기화 없이 새 파일을 순차 추가하고, 백업·복구 전략을 리뷰한 다음에만 별도 적용한다. 프로덕션 데이터와 운영 환경변수는 테스트 대상으로 사용하지 않는다.

## 시나리오로 스킬 선택 검증 (절차 예시; 기능 구현·마이그레이션 실행 아님)

| 시나리오                     | 스킬                                                                                 | 확인 및 실패 판정                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. 반복 요일 설정 UI         | feature-builder, design-guardian, accessibility-auditor, data-guardian, quality-gate | 기존 Habit/날짜 스냅샷에 반복 요일이 있는지 먼저 조사한다. 선택 토글의 명확성·44px 터치·키보드·모바일/테마와 기존 날짜 호환성을 확인한다. 타입/단위/브라우저/필요 시 DB 테스트를 실행한다. 과거 기록이 바뀌거나 요일 선택이 재시작 후 유실되거나 상태를 식별할 수 없으면 실패. 현재 제공 기능이라고 가정하지 않는다. |
| B. Supabase 데이터 모델 변경 | feature-builder, data-guardian, quality-gate                                         | 현재 SQL·RLS/RPC·클라이언트 소비자와 기존 데이터 읽기 경로를 추적한다. 신규 순차 마이그레이션과 구버전 클라이언트·오프라인 Outbox 호환성, 계정 격리/복구를 검토하고 독립 테스트 DB에서 RLS/동기화 검증. 기존 기록 유실, 계정 간 노출, 이전 명령 처리 실패, 운영 재실행 요구면 실패.                                  |
| C. GitHub CI 실패 수정       | quality-gate (배포 판단까지 포함되면 release-guardian)                               | 실패한 run/SHA/단계를 확인하고 현재 main 기준선과 비교한다. 동일 환경에서 좁은 재현 → 최소 수정 → 관련 테스트 → 전체 CI 재확인. 원인 확인 없이 테스트 삭제·스킵하거나 새 브랜치 CI 실패를 기존 실패로 치부하면 실패.                                                                                                 |

## 리뷰와 출시

GitHub PR에서 변경 파일·CI 상태를 확인한다. 사용자 데이터/인증/RLS/동기화, PWA 서비스 워커·캐시, 환경변수 변경은 별도 위험으로 보고한다. 검증의 범위와 미실행 항목을 명시한다. 기존 v0.app Publish를 유지하고 운영 데이터 변경이나 배포를 문서 작성의 부수 효과로 실행하지 않는다. [운영·복구](operations.md)를 출시 전 함께 확인한다.

## 하네스 3.1 이해관계자 품질 게이트

[Stakeholder Harness](STAKEHOLDER_HARNESS.md)로 역할 선택·독립 검토·비판적 반박·재반박·수정·동일 기준 재평가(최대 3회)를 수행한다. 기술 검증의 기준과 필수 CI를 약화하지 않는다. 위젯 시안, 신규 기능 발굴, 사업 모델, 마케팅은 필요한 패널을 선정하고 아키텍처·코드 리뷰·구현·운영은 해당 기술 전문가를 함께 선정한다. 간단한 CI 결함은 기술 보호 스킬만 적용한다. 중요 검토는 최소 2회, 최대 3회이며 미해결 핵심 위험은 보류한다. `pnpm validate:skills`는 기존 스킬 검증에 더해 역할 가중치, 라우팅 참조, 시나리오 선택 및 실제 파일 존재를 검사한다. 패널 검토 결과와 실제 실행 검증을 구분하며, 사용자 승인 없는 운영 변경은 금지한다.
