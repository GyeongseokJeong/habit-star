# 운영과 복구

## 최소 장애 감지·대응 (1인 개발 / Supabase Free)

별도 모니터링 SDK·새 데이터 수집·주기적 운영 DB 폴링 없이, **GitHub 기본 실패 알림 + 배포 후 수동 확인 + 문제 발생 시 Supabase 로그·집계 조회**를 사용한다. GitHub CI는 코드 품질 검사이지 실제 운영 서비스의 24시간 가용성 감시가 아니다.

### 1. 알림 설정 (GitHub 계정 소유자가 직접 설정)

1. [저장소](https://github.com/GyeongseokJeong/habit-star)의 `Watch` 상태를 확인하고, [GitHub 알림 설정](https://github.com/settings/notifications)에서 **System → Actions → Email(또는 On GitHub) → Only notify for failed workflows**를 선택해 저장한다. GitHub에서 실제 알림 수신을 보장하는지 메일함/웹 알림을 확인한다.
2. 해당 설정은 **개인 GitHub 계정별** 설정이다. 저장소 코드·CI 워크플로만으로 자동 활성화되거나, 내가 트리거하지 않은 모든 실행의 알림 수신을 보장하지 않는다. 연결 앱을 통한 직접 설정/확인은 지원되지 않는다.
3. [Actions](https://github.com/GyeongseokJeong/habit-star/actions)에서 **main 커밋의 `CI / verify`와 `CI / cloud`**가 모두 성공했는지 확인한다. Android 실험 브랜치 검사 및 Vercel 외부 상태와 혼동하지 않는다.

### 2. 언제 확인하나?

- **main 병합 직후:** 위 두 CI 검사와 운영 [Vercel A 프로젝트](https://vercel.com/jassetbiz-4993/habit-star) Production 배포 상태를 각각 확인한다. CI 통과는 Vercel 배포 성공의 증거가 아니다. 운영 웹에서 직접 초기화면·로그인·습관 읽기/기록을 간단히 확인한다.
- **사용자가 오류를 보고할 때:** 발생 시각(시간대 포함), 브라우저/기기, 재현 단계, 온라인 여부, 화면상의 동기화 상태만 취합한다. 비밀번호·토큰·이메일·습관 제목·메모·원본 JSON은 이슈나 로그에 기록하지 않는다.
- **공개 베타 전/사용자 증가 시:** 기존 중단 기준과 백업·복구 리허설을 재검토한다. 현재는 지속 감시·자동 경보·Supabase 로그 쿼리 폴링이 **설치돼 있지 않다**.

### 3. 오류가 보이면 이렇게 분류

| 신호 | 첫 확인 | 다음 대응 |
| --- | --- | --- |
| `main` CI 실패 | 실패 run/커밋 SHA와 정확한 `verify`/`cloud` 실패 단계 | 코드/테스트 실패와 Docker·포트 충돌 같은 환경 실패를 구분한다. 환경 장애가 입증된 경우에만 해당 작업 재실행, 테스트 삭제·스킵 금지 |
| 가입·로그인·이메일 실패 | 운영 Site URL/Redirect URL, 실제 화면 오류, [Supabase Auth 로그](https://supabase.com/dashboard/project/skurplixxtdpjbmnyhhm/logs/explorer) | 같은 시간대의 Auth 요청 메서드·경로·HTTP 상태만 조회. 단순 `GET / 500`을 로그인 실패로 단정하지 않고 테스트 계정에서 재현 |
| 기록 누락·동기화 지연 | 기기 로컬 Outbox, 마지막 동기화 완료 표시, 네트워크·계정 상태 | 아래 **읽기 전용 SQL 집계**로 서버 충돌/가져오기 상태 확인. 서버에 오류가 없어도 단말 대기 작업이 남을 수 있다 |
| 계정 간 데이터 노출·원본 유실·가져오기 무결성 실패 | 관련 작업 중지, 재현 단말/시각/커밋·배포 정보 | 즉시 아래 중단 기준과 롤백 절차를 따른다. 원본·Outbox·이력 보존, 운영 DB reset 금지 |

### 4. SQL 집계 및 로그 보안

아래 **중단 기준**에 있는 `conflicts`, `import_batches`, `sync_operations` 쿼리만 관리자 연결에서 **SELECT**로 확인한다. `sync_operations` 총건수는 누적 참고치일 뿐 정상 동기화의 증거가 아니다. Supabase Logs는 시간 범위·Auth/DB/API 서비스·요청 상태로 좁혀 확인한다. HTTP 상태 건수만으로 실제 가입/로그인이 완전히 성공했다고 판정하지 않는다.

정상 네트워크·유효 세션에서 Outbox 5분 초과 기기 비율 **1%** 기준은 단말 상태를 실제로 관찰할 수 있을 때만 적용한다. 서버 SQL로 기기별 Outbox 대기 비율을 계산할 수 없으므로, 현재는 사용자 보고 1건도 재현·분류한다.

관련: [GitHub Actions 실패 알림](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications), [Supabase Logs](https://supabase.com/docs/guides/observability/logs), [실사용 검증 #65](https://github.com/GyeongseokJeong/habit-star/issues/65), [최소 장애 대응 #69](https://github.com/GyeongseokJeong/habit-star/issues/69).

## 출시 전

- 별도 Supabase 테스트 프로젝트에서 마이그레이션·이메일 가입/확인·재설정·두 계정 격리를 검증합니다.
- 서로 다른 브라우저의 동시 별점/메모, 오프라인 편집, 세션 만료, 로그아웃/다른 계정 로그인, 삭제 충돌, 가져오기 중단·재개를 확인합니다.
- Supabase의 DB 백업/PITR 지원 여부와 실제 복원 절차를 확인하고 테스트 복원합니다. 백업 스냅샷과 복원 시각을 운영 기록에 남깁니다.
- 실제 도메인·SMTP·발송 제한·리디렉션을 설정합니다. HTTPS와 CA 검증을 끄지 않습니다.
- 앱 셸만 SW에 캐시합니다. 개인화/no-store/인증/쿼리 포함 탐색은 캐시하지 않습니다. 새 SW의 기존 캐시 정리와 오프라인 재진입을 점검합니다.

## 점진 노출

`NEXT_PUBLIC_CLOUD_ENABLED` 기본값은 false입니다. 내부 계정 → 명시적 베타 → 10% → 50% → 전체 순서로 배포 대상/호스트를 나눕니다. 앱에 개인 식별 추적이나 임의 사용자 해싱을 추가하지 않습니다. 각 단계 최소 24시간 확인 후 운영자가 확대합니다.

서버에서 즉시 쓰기·가져오기를 중단하려면 관리자 SQL에서 실행합니다. 클라이언트에는 이 테이블 권한이 없습니다.

```sql
update private.sync_controls set writes_enabled=false,imports_enabled=false where singleton;
-- 수정/검증 후 재개
update private.sync_controls set writes_enabled=true,imports_enabled=true where singleton;
```

읽기는 계속 허용되고 로컬 Outbox는 삭제되지 않습니다. 중단된 서버 쓰기는 실패로 표시되며 재개 후 재시도할 수 있습니다. 신규 Auth 가입 중지는 Supabase Auth 설정에서 별도로 수행합니다.

## 중단 기준

- 계정 간 노출 또는 재현 가능한 기록 누락/원본 덮어쓰기 1건
- import 해시·건수 검증 불일치 1건
- 정상 네트워크·유효 세션에서 5분 이상 Outbox가 남는 기기 비율 1% 초과

메모·제목·이메일·JWT·원본 JSON을 로그에 남기지 않습니다. 서버에서는 아래처럼 집계만 확인합니다. Outbox 대기 시간/기기 비율은 베타 참여자의 상태 확인으로 수집하며 외부 telemetry SDK는 연결하지 않았습니다.

```sql
select count(*) filter(where not resolved) as unresolved_conflicts from public.conflicts;
select status,count(*) from public.import_batches group by status;
select count(*) as operations from public.sync_operations;
```

## 롤백

1. 서버 쓰기/import를 중지하고 원인을 보존합니다. DB·Outbox·v1·v2를 삭제하지 않습니다.
2. 마지막 v2 호환 배포로 되돌립니다. 최초 v1 앱으로 직접 복귀하면 신규 기록을 읽을 수 없습니다.
3. 실패한 staging은 확정 전이므로 기존 기록을 변경하지 않습니다. 완료 import를 일괄 삭제하지 않습니다.
4. 잘못된 완료 import의 operation ID와 이후 version을 대조해 관리자 보상 명령을 검토합니다. 이후 편집된 행은 자동 제거하지 않습니다.
5. 클라이언트 백업은 계정 메뉴에서 내려받습니다. 복원은 기록 없는 같은 계정/비회원 공간만 허용하며 기존 데이터는 덮어쓰지 않습니다.
6. 수정 후 격리·원본·작업 수·충돌 사본과 복구 테스트를 다시 검증하고 단계적으로 재개합니다.

## PR #3 스키마 업데이트

이미 001을 적용한 DB에는 002(가져오기 검증/충돌 상태 보정), 003(JSON 타입 검증)를 순서대로 추가 적용합니다. 001 파일을 수정하거나 운영 데이터를 초기화하지 않습니다. 002는 잘못 완료 표시된 충돌 배치의 메타데이터만 보정하고 습관·원본 staging·불변 작업 결과는 유지합니다.

클라이언트는 `verified: true`가 없는 예전 서버 응답을 성공 처리하지 않습니다. 따라서 DB를 먼저 업데이트한 다음 새 클라이언트를 배포하세요. 서버 RPC와 클라이언트를 이전 버전으로 함께 되돌리면 잘못된 완료 표시 문제가 재발하므로, 롤백 시에도 보정 RPC와 원본/journal을 유지합니다.

가져오기 충돌은 명시적으로 해결한 뒤 같은 배치를 재개합니다. 응답 유실 시 새로운 ID를 만들거나 staging을 지우지 마세요. 성공은 서버의 applied 이력 검증 + 독립 재조회 + 로컬 일치 검증을 통과했을 때만 기록합니다. 정상적인 후속 편집은 더 높은 서버 버전/변경 이력으로 확인합니다.
