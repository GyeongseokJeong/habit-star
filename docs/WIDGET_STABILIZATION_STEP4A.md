# STEP 4A — 위젯 기록 후 정상 앱 복귀 안정화

기준: main 5f7d68e, #221 병합 및 main CI 성공, V12.2 실기기 5/5 정상. #189. V12.2 디자인 동결. 이번 PR은 background network/알림 직접 재예약 또는 release 활성화가 아니다.

## 검토 범위와 합의
architecture + data + implementation, 제품/사용자(B 바쁜 위젯 사용자, C 다기기 회원) 및 운영 관점 추가. stakeholder-panel, software-architect, senior-fullstack-developer, clean-code-specialist, product-planner, user-perspective, server-operations-specialist, data-guardian, feature-builder, quality-gate의 역할 정의 확인. 동일 모델 관점 검토이며 독립 전문가/에이전트·실제 사용자 조사 아님.

| 쟁점 | 라운드 | 제안→반박→결정/수용 조건 |
|---|---|---|
| S4-01 | 1 | 제품/사용자: 완료 알림·다기기 기록 불일치 해결. 아키텍트/데이터: cold runtime에 인증/네트워크/예약 전체 복제하면 경쟁·토큰·원본 경계 확대. 풀스택: 먼저 기존 정상 앱의 재개 경로를 정리하고 동일 Outbox/SyncEngine으로 재전송 검증. 채택, owner fullstack; 실제 cold 즉시 알림/서버 전송은 별도 게이트. |
| S4-02 | 1 | 풀스택: resume 권한 확인도 예약을 실행. QA: permission Promise가 repository refresh보다 먼저 끝나면 오래된 snapshot으로 예약할 수 있음. 권한 조회와 resume 예약 분리, 새 snapshot publication으로만 예약. owner fullstack; 양 resume 이벤트 소스 계약. |
| S4-03 | 2 | 클린코드: 직렬 queue의 과거 자동 snapshot도 나중에 실행될 수 있음. 제품: 명시적 알림 ON/OFF 편집을 조용히 생략하면 안 됨. 자동 snapshot/권한 reconciliation에만 currentOnly guard, 명시적 설정 저장 경로 유지. owner fullstack; stale scope/snapshot 검사, 수동 동작 회귀 확인. |
| S4-04 | 2 | 운영/데이터: mock 성공은 실제 Supabase 또는 기기 alarm 성공이 아님. QA: 저장 후 repo reopen, 동일 operation ID 응답 유실 재시도, 완료/취소와 오늘·미래 알림 plan 검증. owner quality-gate; mock transport임을 명시, 실제 회원 왕복 및 OS 예약은 보류. |

동일 기준 재검토: 원본/계정 경계와 오류 격리 보존, 자동 경로만 최소 수정, 테스트 증거 추가. 제품 가치는 실기기 검증 전 N/E, 운영/통합 검증 N/E. 실제 독립 에이전트 없음. 설계의 새 핵심 이견은 없으나 4B/4C 및 release 게이트는 열어 둔다.

## 변경
- resume(visibility/native appStateChange)에서 기존 800ms refresh dispatcher를 먼저 호출, 권한 조회는 reconcileSnapshot=false. repository ensureDay/load/sync 및 onSnapshot 경로가 예약을 구동. 최초 초기화의 권한/저장 preference reconciliation 유지.
- 자동 예약 queue는 시작할 때 captured snapshot/identity와 현재 값이 다르면 건너뜀. 이미 진행 중인 native 호출의 원자적 취소를 보장하지 않음. 명시적인 설정 저장과 기존 retry/permission/opt-in 정책은 유지.
- cold member transaction→repository reopen→outbox→기존 SyncEngine의 simulated idempotent transport 테스트. 응답 유실 후 동일 op ID 유지/재전송 및 완료/취소 서버 모델, 오늘 알림 계획 제외/복구, 미래 예약 유지. 실제 OS 취소나 실제 Supabase 인증/RLS/동기화 증거 아님.
- DB schema/auth/원본/Widget UI/권한/Release flag 무변경. 운영 변경 없음.

## 후속 게이트
4B: 앱 종료 상태의 실제 예약 취소/복구는 알림 owner·scope·day 및 충돌 검증, 기존 native 알림 경로와 일관성 검증 후 구현. 4C: 회원 실제 계정에서 오프라인 cold 기록 후 앱 재진입·다른 기기 확인 및 인증 만료/계정 전환. 4D: 경계·회귀. release 직접 기록은 모든 필수 게이트 전 비활성.
