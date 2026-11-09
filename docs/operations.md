# 운영과 복구

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
