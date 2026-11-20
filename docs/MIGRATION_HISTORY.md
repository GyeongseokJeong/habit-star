# Supabase 운영 마이그레이션 이력 정합성

2026-11-20 별하루 운영 Supabase 프로젝트의 `supabase_migrations.schema_migrations`와 GitHub SQL 원문을 읽기 전용 비교했다.

## 확인 결과

원격 이력 4건 모두 `statements[1]`의 SQL 텍스트가 각 GitHub 원본 파일의 전체 텍스트와 **정확히 동일**했다. 이 작업은 SQL 내용을 수정하지 않고 **GitHub 마이그레이션 파일명 및 참조 경로만** 원격 이력의 타임스탬프에 맞춘다. 기존 사용자 데이터, 스키마, RLS 및 DB migration history는 변경하지 않는다.

| 원격 적용 버전 | 원격 name | 기존 GitHub 파일 | 정합화한 GitHub 파일 |
| --- | --- | --- | --- |
| `20261110012142` | `202611100001_cloud` | `202611100001_cloud.sql` | `20261110012142_cloud.sql` |
| `20261110012720` | `202611100002_import_integrity` | `202611100002_import_integrity.sql` | `20261110012720_import_integrity.sql` |
| `20261110012910` | `202611100003_input_validation` | `202611100003_input_validation.sql` | `20261110012910_input_validation.sql` |
| `20261120014510` | `repeat_days_validation` | `202611110001_repeat_days.sql` | `20261120014510_repeat_days_validation.sql` |

원격 `name`은 과거 적용 당시의 명칭으로 유지된다. Supabase CLI 공식 문서에 따르면 `migration list`는 로컬 파일과 원격 이력을 **버전 타임스탬프**로 비교한다. SQL 본문과 별개로 파일명 뒤쪽의 설명 텍스트가 원격 name과 같아야 하는 것은 아니다.

## 후속 개발자가 지킬 절차

1. 로컬 `supabase/migrations/`에 정확히 **위 4개의 파일**이 있는지 확인하고, 원격 프로젝트 ref를 다시 확인한다.
2. `pnpm exec supabase migration list --linked`로 **로컬/원격 버전 4건이 일치**하는지 확인한다. 로컬 Supabase CLI가 실제 프로젝트에 연결된 환경에서만 가능하다.
3. 버전 불일치가 발견되면 `db push`, `migration repair`, `db reset`을 실행하지 않는다. 먼저 SQL 본문, 원격 이력, 실제 스키마를 비교한다.
4. 새 마이그레이션은 CLI의 `supabase migration new <name>`으로 **새 버전**을 만들고, 별도 리뷰 후 순차 적용한다. 기존 4개 파일을 재사용하거나 변경하지 않는다.
5. 로컬 테스트: `pnpm test:db --postgres`, `pnpm test:db` (로컬 Supabase), `pnpm test:e2e:cloud`. 이 리포지토리에서 CI `verify`/`cloud`로 확인한다.

이 문서와 파일명 변경은 **운영 Supabase에 연결하거나 배포하지 않는다.** 병합 전 CI 통과와 병합 후 로컬/원격 `migration list` 확인은 별도로 기록한다.

참고: [Supabase migration list](https://supabase.com/docs/reference/cli/supabase-migration-list), [운영·복구 절차](operations.md), [Issue #68](https://github.com/GyeongseokJeong/habit-star/issues/68).
