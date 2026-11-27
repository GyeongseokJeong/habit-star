# STEP 4C — 회원 위젯 기록의 실제 클라우드 동기화 통합 검증

기준 main a13df69 / #228 병합, #189, STEP 4A/4B. V12.2 디자인 동결. **Debug 직접 기록의 서버 계약을 확인하는 테스트 PR**이며, Release 직접 기록을 활성화하거나 cold WebView에서 통신하지 않는다.

## 결정 및 하네스
`architecture + data + implementation + android` (architect, clean-code, fullstack, QA, Android, security), PM/UX/사용자 관점 추가. 기존 stakeholder-panel / feature-builder / quality-gate / data-guardian 적용. 독립 QA/Android, 아키텍처/보안, PM/UX/사용자 서브에이전트와 구현·클린코드 검토.

| 쟁점 | 1차 제안 및 반박 | 수정·2차 재평가 기준 |
|---|---|---|
| 실제 회원 왕복 | 4A Map transport 대신 실제 로컬 Supabase. Android/WebView 생명주기를 브라우저 테스트로 대신했다는 주장은 기각. | Node/가상 IDB 기기에서 실제 앱 repository/cold command를 실행, 일반 브라우저 독립 저장소/로그인에서 0→5→0 확인. 클라우드만 확증; 실기기 NOT RUN. |
| 중복 방지 | 단순 Outbox 비움만으로 멱등성 입증 불가. | 실제 RPC 성공 직후 응답 유실 주입 → 원본 op ID·payload 보존 → 동일 요청 재전송, 서버 receipt 1행·동일 entry version/revision·최종 Outbox 0건. |
| 데이터/계정 | 토큰 복제·서비스 롤·운영 접근·직접 DB 쓰기 금지. 단순 B 세션의 UUID 사용은 소유권 검증 아님. | 이메일 검증된 실제 로컬 회원 A/B의 publishable key와 SDK 로그인; A scope에 B 세션 토큰을 사용한 SyncEngine은 auth_required, A 기록/Outbox 보존, B RLS 조회 0행, 직접 쓰기 금지, anon RPC 거부. A 재로그인으로 기존 op 복구. |
| 인증/UX | 로컬 만료와 실제 JWT 만료를 혼동 금지. 기록 성공은 로컬 저장 성공이며 서버 성공 표시는 동기화 이후에만 가능. | 실제 session을 앱과 같은 저장 키에 넣고 만료/near-expiry/검증 키 누락은 fixture로 검증. 실제 SDK 로그아웃·타 계정 인증은 별도. 런처·백업 동의·서버 JWT 자연 만료 및 실기기 미검증. |

2차 검토 권고 반영: 실제 sync_state revision 비교, 다른 계정의 별도 습관과 revision 보존, cold recovery 중 인증 캐시 변경, 브라우저 메모와 취소 전 상태 검사. 핵심 상충 이견은 없음. R2 코드 검토는 정적 근거이며 자동화는 CI로 판정한다.

## CI 자동화 인수
기존 `scripts/test-cloud.mjs` 및 `tests/e2e/cloud.spec.ts`에서 수행. CLI가 관리하는 http://localhost/127.0.0.1:54321만 허용, 일회성 `example.test` 계정과 로컬 Mailpit 확인. 운영 프로젝트·사용자·데이터에 접근하지 않음. production runtime, schema, RPC, 정책, Release flag, 기존 UI 변경 없음.

| ID | 자동화 검증 |
|---|---|
| C01 | 실제 회원 최초 hydrate → 평소 저장소로 습관/메모 작성·동기화 → 원본과 generation으로 cold 완료(네트워크 fetch 차단 및 호출 0) → repository 재오픈·5점/메모/Outbox 1건, 동일 오래된 handle 재실행 거부, 서버·브라우저는 이전 0점 상태 |
| C02 | 정상 SyncEngine와 실제 apply_operation 후 응답 유실 → 동일 요청 재전송 → owner read receipt/version/revision 불변 및 독립 브라우저 5점. 새 generation으로 cold 취소 및 0점 동기화·브라우저 확인 |
| C03 | 실제 session의 cached expires_at 만료/near-expiry와 검증 키 누락에 원본 변경 없음. 실제 SDK signOut 후 auth_required, 대기 op 보존; 별도 확인된 계정 B 로그인으로 A handle 및 A sync 거부, recovery 중 저장된 계정 전환도 거부, B scope와 서버 revision 및 A 데이터 보호; RLS·anon/direct write 제한, 동일 A 재인증 후 기존 op 동기화 |

`fake-indexeddb`는 Node 테스트의 가상 기기 저장소이며 native guard는 테스트용 true; 실제 브라우저 관찰은 독립 기기 저장소의 웹 동기화 계약이다. fetch 차단은 실제 OS offline이 아니며, lost acknowledgement는 서버 성공 후 클라이언트 예외를 주입한다. 실제 JWT 만료/강제 종료/백그라운드 안드로이드 재진입·하루 경계·실제 기기 간 동기화·알림/런처 상태는 이 자동화에서 검증하지 않는다. 테스트 추가만으로 runtime 결함 해결 또는 Release 승인으로 해석하지 않는다.

## 남은 4C 실기기 + 4D
테스트 계정 A의 미완료 습관/메모를 준비, 다른 기기에 같은 A 로그인. Debug APK에서 기기 네트워크 OFF, 프로세스 종료(강제 중지 아님), 위젯 완료 → 앱 재진입(오프라인 기록/대기) → ON/정상 앱 sync → 기기 B 5점·메모 확인 → 같은 방식 취소 0점. 인증 만료·계정 변경 시 기록 유실/다른 계정 노출/잘못된 재전송 없음; 로그아웃의 기존 대기 기록 백업 및 명시 확인 정책 준수. 4B alarm 취소·복구 및 실제 전달, 날짜/시간대·DST·연속 탭·충돌·권한·프로세스 경계의 종합 회귀와 Release 읽기 전용 검사 병행. 실제 기기 결과와 Release 활성화 결정은 별도 기록한다.

현재 환경에 Docker/로컬 Supabase 및 프로젝트 의존성 설치가 없으므로 실제 통합·타입·회귀 실행은 GitHub CI의 해당 head SHA로 판정한다. 실기기 및 사용자 관찰 NOT RUN / N/E.
