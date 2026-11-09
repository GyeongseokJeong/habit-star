# PR #3 데이터 정합성·동기화 상태 보완

대상은 `codex/byeolharu-v2-step01`이며 기존 PR #3에 수정 커밋을 추가합니다. main 병합이나 새 PR 생성은 수행하지 않습니다.

## 발견과 원인

| 문제 | 원인 | 보완 |
| --- | --- | --- |
| 충돌 가져오기가 성공으로 표시됨 | 서버가 conflict 결과도 complete로 저장하고 클라이언트가 journal을 삭제 | applied 이력/현재 서버 행 검증 후 완료. conflict는 journal·원본·작업 결과 유지 |
| 해결 후 같은 import를 재시도해도 cached conflict만 반환 | 동일 operation ID의 불변 결과를 다시 사용 | 소유자별 명시적 해결 작업 체인을 따라가서 적용 증명을 확인. 다른 entity로 해결하는 요청 거부 |
| 해결 응답 유실 뒤 재전송이 거부됨 | 해결 여부 검사가 기존 작업의 멱등 결과 확인보다 앞섬 | 동일 ID/동일 요청은 기존 결과 반환, 같은 ID의 다른 요청은 거부 |
| refresh가 서버 실패를 완료 표시로 바꿈 | 빈 Outbox만으로 상태 산출 | 최초 snapshot, 마지막 성공 시각/cursor/로컬 revision, 현재 시도 결과를 영속화하여 산출 |
| 충돌 해결을 누른 즉시 완료처럼 보임 | 서버 ACK 전에 로컬 resolved 플래그 설정 | 선택을 Outbox에 보존하고 ACK까지 충돌 표시·중복 선택 차단 |
| 다른 기기가 먼저 해결하면 내 선택이 재전송 불가 | 이미 해결된 conflictId를 계속 사용 | 서버 해결을 재조회한 뒤 선택을 새 CAS 요청으로 보존·재평가 |
| 검증과 RPC 사이 세션 변경 시 다른 사용자 토큰을 사용할 수 있음 | 공유 SDK의 전역 session을 두 시점에서 사용 | 특정 token으로 getUser 검증 후 그 token을 단일 RPC Authorization에 고정. 비동기 UI 작업도 계정/epoch에 고정 |
| 잘못된 timeGroup JSON null이 저장됨 | SQL NULL 비교 결과가 false가 아니라 NULL | 명시적인 JSON 타입 검증 및 변경 명령 필수 필드 검사 |
| 저장소 준비 전 복원 호출이 성공처럼 종료될 수 있음 | 준비되지 않은 restore가 조용히 반환 | 준비 전 업로드 차단, 실제 복원 완료/계정 일치 이후에만 성공 표시 |
| Google Fonts 차단으로 빌드 불가 | 빌드 시 외부 Google API 호출 | 동일 글꼴 Fontsource 패키지를 lockfile로 고정해 자체 제공, 라이선스 포함 |

## 핵심 변경 파일

- `lib/habits/sync.ts`: 검증한 토큰 고정, 가져오기 journal/검증/재개, 계정별 sync/import 잠금, 더 오래된 서버 행으로 덮어쓰기 방지.
- `repository.ts`, `sync-status.ts`, `use-habit-app.ts`: 영속 상태·로컬 revision, 로컬/클라우드 상태 분리, 늦게 도착한 다른 계정 응답과 캐시 격리.
- `components/account/account-panel.tsx`: 실패·충돌·인증 만료·검증 중·완료 구분, 재개 버튼, 마지막 성공 시각.
- `supabase/migrations/202611100002_import_integrity.sql`, `003_input_validation.sql`: 기존 001 원문을 유지하는 추가 마이그레이션. 원본 데이터 삭제 없이 과거 false completion 보정.
- `app/layout.tsx`, `globals.css`, 패키지/lockfile, `public/licenses`: 자체 제공 Noto 글꼴.
- `tests`, `supabase/tests`, DB runner, 프로덕션 Playwright 설정, CI: 아래 회귀와 업그레이드/프로덕션 검증 추가.

## 회귀 검증

수정 전에 단위 회귀 8개가 실패했고, DB의 conflict-complete 검증도 실제 실패를 확인했습니다. 이후 해결 재전송, JSON null, 토큰 전환 경쟁 조건 역시 실패를 재현한 후 수정했습니다.

- 가져오기 conflict에서 성공 마커 금지·journal/원본 보존.
- applied 응답 뒤 독립 재조회 실패/같은 버전의 데이터 불일치 시 성공 금지.
- 해결 후 같은 배치 재개, 응답 유실/세션 만료 후 checkpoint 보존과 중복 방지.
- SDK의 실제 PostgREST builder에서도 인증 검증 뒤 세션이 바뀌어도 기존 계정 token을 유지.
- 빈 Outbox/부분 snapshot만으로 완료 금지, 실패 상태가 cache refresh 뒤에도 유지, 7가지 상태 구분.
- 같은 날짜 별점·메모 및 습관 정의/오늘 snapshot의 다기기 동시 수정과 명시적 해결.
- 서버 ACK 전 해결 완료 표시 금지, 같은 선택의 중복 전송 방지, 다른 기기가 먼저 해결한 경우 내 선택의 보존과 재평가.
- 서로 다른 실제 회원 계정 전환/로그아웃 시 개인 기록 및 cache 격리.
- 이미 존재하는 동일 ID import, 무관한 entity로 충돌 해결 시도, private 함수/anon/RLS 접근 거부.
- 001의 잘못 완료된 배치를 미리 만든 뒤 002/003 업그레이드: 원본 행·staging·불변 결과 보존, 상태 보정 및 재개 확인.
- 저장소 준비 이후 복원, 실제 로컬 commit 완료 이후 reload를 검증합니다. 대기 시간을 늘려 숨기지 않고 화면의 완료 상태를 확인합니다.
- 프로덕션 서버의 외부 font 요청 부재, SW 오프라인 reload/편집/재연결 후 보존.

## 적용·위험

DB 후속 마이그레이션을 먼저 적용하고 클라이언트를 배포합니다. 기존 001을 수정하거나 DB를 초기화하지 않습니다. 이전 서버의 검증 없는 응답은 새 클라이언트가 성공 처리하지 않습니다. 충돌에서 사용자가 클라우드 값을 고르면 그 선택을 검증하며, 가져오기 원문과 해결 이력은 계속 보존합니다.

로컬 테스트는 운영 SMTP·실제 모바일 OS·운영 부하/PITR 복원 검증을 대체하지 않습니다. GitHub API 차단으로 원격 CI/승인 상태를 확인할 수 없으므로 로컬 통과만으로 PR을 병합 승인 상태라고 주장하지 않습니다. 실 실행 결과는 완료 보고와 커밋 기준으로 확인합니다.

## 실 실행 결과 (2026-11-10 KST)

| 명령 | 결과 |
| --- | --- |
| `pnpm typecheck` | 통과 |
| `pnpm test` | 단위 회귀 39개, 5개 파일 통과 (skipped 없음) |
| `pnpm test:db` | 실행 중인 로컬 Supabase에서 SQL suite 3개 통과 |
| `pnpm test:db --postgres` | 새 PostgreSQL에 001→002/003 적용, 과거 잘못 완료된 배치의 업그레이드/보존/재개 및 SQL suite 3개 통과 |
| `pnpm test:e2e` | 비회원 회귀 5개 통과 |
| `pnpm test:e2e:cloud` | 실제 로컬 Supabase 회원 시나리오 5개 통과 |
| `pnpm build` | 자체 제공 글꼴로 프로덕션 빌드 통과 |
| `pnpm test:e2e:production` | 실제 프로덕션 서버에서 자체 글꼴·SW 오프라인 재진입/편집/재연결 보존 1개 통과 |

브라우저 검증에는 시스템 Chromium을 `CHROMIUM_PATH=/usr/bin/chromium`으로 지정했고, 관리 환경의 사용자 설정 디렉터리 쓰기 제한을 피하기 위해 Next telemetry를 비활성화했습니다. TLS·체크섬·테스트 assertion은 끄지 않았습니다. 중간 실패는 재현/진단 후 수정하고, 변경된 최종 코드에서 다시 실행했습니다.

**병합 판단:** 로컬 수정 검증은 통과했습니다. 다만 원격 GitHub Actions·리뷰 승인 상태를 조회할 수 없으므로 최종 병합 승인은 보류합니다. 원격 필수 CI 통과와 운영 DB의 후속 마이그레이션 적용 계획을 확인한 뒤 병합하세요. 운영 SMTP·실제 모바일 OS·운영 부하·PITR 복원 연습은 이번 검증에 포함되지 않았습니다.
