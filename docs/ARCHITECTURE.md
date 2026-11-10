# 현재 아키텍처

Next.js 16 App Router + React 19 + TypeScript. `app/page.tsx`에서 클라이언트 `components/byeolharu.tsx` 화면을 제공하고 `lib/habits/use-habit-app.ts`가 화면의 상태와 기록 동작을 연결한다. `lib/habits/domain.ts`가 Habit·날짜·Entity·Operation 모델을 정의한다. 앱의 클라우드 기능은 `NEXT_PUBLIC_CLOUD_ENABLED`로 기본 비활성이다.

## 저장·인증·동기화

- `lib/habits/repository.ts`: IndexedDB `byeolharu-v2`의 `scopes`(비회원/회원별 로컬 상태)와 `backups`를 사용한다. 상태·Outbox를 트랜잭션으로 보존하고 BroadcastChannel로 탭 간 갱신을 알린다. `lib/habits/migration.ts`는 v1 localStorage 원문을 먼저 백업하고 유효 행을 변환한다. 샘플 습관은 신규 비회원 공간 초기 화면용이며 실제 계정/기록 데이터가 아니다.
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `proxy.ts`, `app/auth/*`: Supabase Auth의 브라우저/서버 세션, 인증 콜백·확인·비밀번호 재설정. 회원 데이터 접근은 확인된 사용자 ID에 맞춰야 한다.
- `lib/habits/sync.ts`: 인증된 회원의 로컬 Outbox → 소유자 고정 RPC `apply_operation`, 서버 변경 → `pull_changes` → 로컬 반영. 버전·작업 ID·충돌 사본을 유지한다. `supabase/migrations/202611100001_cloud.sql`부터 003까지 RLS/RPC/검증이 누적된다. 직접 테이블 쓰기를 대체 경로로 열지 않는다.
- 비회원 기록을 회원 공간으로 가져오는 동작은 자동 동기화가 아닌 명시적 동의·검증·staging/commit 절차다. 계정 변경·오프라인·충돌·응답 유실 시 원본과 미전송 작업을 잃지 않아야 한다. 상세 불변식과 순차 마이그레이션 주의사항은 [구현 기록](implementation.md) 및 [운영·복구](operations.md)를 참조한다.

## 검증·배포 경계

`tests/*.test.ts`는 도메인/저장/동기화, `supabase/tests/*.sql`은 PostgreSQL RLS/RPC, `tests/e2e/*.spec.ts`는 Playwright 브라우저 시나리오다. `.github/workflows/ci.yml`은 verify와 별도 로컬 Supabase cloud job을 실행한다. `public/sw.js`는 앱 셸 PWA 캐시를 다루며 개인 데이터·인증 응답은 캐시하지 않는다. v0.app Publish는 기존 Vercel 배포 방식이며 이 하네스는 호스팅·환경변수·DB 설정을 바꾸지 않는다. 실행 조건은 [개발 규칙](DEVELOPMENT_RULES.md)을 따른다.
