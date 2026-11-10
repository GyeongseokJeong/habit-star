# 별하루 / habit-star

Next.js 16 · React 19 · TypeScript 기반 습관 기록 앱입니다. 비회원 기록은 브라우저 IndexedDB에 저장하고, 이메일 인증 회원은 Supabase Auth/PostgreSQL과 동기화합니다. 클라우드는 기본적으로 꺼져 있습니다.

## 개발

Node 24.22.1, pnpm 11.25.0을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

브라우저 테스트 전에 `pnpm exec playwright install chromium`을 실행하세요. 시스템 Chromium을 사용하려면 `CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e`를 사용합니다. Noto Sans KR/Color Emoji는 lockfile로 고정한 Fontsource 패키지에서 자체 제공합니다. 빌드·실행 시 Google Fonts 접근은 필요하지 않으며 SIL OFL 라이선스는 `public/licenses`에 포함됩니다. `pnpm build` 후 `pnpm test:e2e:production`으로 실제 프로덕션 서버의 글꼴 요청과 오프라인 재진입을 검증합니다.

## 클라우드 연결

1. Supabase 프로젝트를 생성하거나 Docker 환경에서 `pnpm exec supabase start`를 실행합니다. 이메일 확인 기능은 로컬 설정에서도 켜져 있습니다.
2. 원격 프로젝트에는 CLI의 검토 가능한 마이그레이션 절차로 `supabase/migrations`를 순서대로 적용합니다. 이미 001을 적용한 환경도 002/003 후속 마이그레이션이 필요합니다. 원문 마이그레이션을 바꾸거나 운영 DB를 reset하지 않습니다. 이 저장소의 스크립트는 원격 DB를 자동 수정하지 않습니다.
3. `.env.example`을 `.env.local`로 복사하고 프로젝트 URL과 **publishable key**, 인증 후 돌아올 `NEXT_PUBLIC_SITE_URL`을 설정합니다. 운영 URL은 HTTPS origin만 허용합니다. `service_role`/secret key는 브라우저에 제공하지 않습니다.
4. `NEXT_PUBLIC_CLOUD_ENABLED=true`로 설정하고 개발 서버를 재시작합니다. 배포에서는 이 값이 빌드 시 포함되므로 다시 빌드합니다.
5. Supabase Auth에서 이메일 확인, 사이트 URL, `/auth/confirm` 및 `/auth/confirm?next=/auth/reset` 리디렉션을 환경의 실제 HTTPS 도메인에 맞게 설정합니다. 운영 SMTP와 발송 제한도 설정하세요.
6. 계정 메뉴에서 가입 → 이메일 확인 → 로그인합니다. 기존 비회원 기록은 자동 업로드하지 않습니다. 계정과 건수를 확인하고 가져오기를 선택하세요.

## DB 검증

```sh
# Supabase 전체 스택이 실행 중일 때
pnpm test:db
pnpm test:e2e:cloud
# 경량 PostgreSQL에 스키마·RLS·RPC를 검증 (Auth HTTP 서버는 검증하지 않음)
pnpm test:db --postgres
```

`test:e2e:cloud`는 실행 중인 로컬 CLI 인스턴스에서 공개 연결 설정만 메모리로 전달합니다. 이메일 확인·두 브라우저 동기화·오프라인 편집·충돌 해결·비밀번호 재설정을 실제 Auth와 검증하며 운영 프로젝트 URL은 허용하지 않습니다.

경량 모드는 매번 전용 테스트 컨테이너를 만들고 종료 시 제거합니다. `DATABASE_URL`이나 운영 DB를 사용하지 않습니다.

## 보존·동기화

- v1 localStorage 네 키는 읽기만 하며 삭제·덮어쓰지 않습니다. 원문은 변환 전에 별도 IndexedDB 백업에 보존합니다.
- 유효하지 않은 행과 현재/이력 불일치는 복구 화면에 남습니다. 원본 백업 후 명시적으로 확인해야 유효한 기록을 가져올 수 있습니다.
- 회원별 로컬 캐시와 Outbox를 분리합니다. 서버는 RLS와 소유자 고정 RPC로 격리합니다.
- 기록 완료는 로컬 트랜잭션 이후 표시합니다. 전송 작업 ID, 버전 비교, 충돌 사본으로 재시도와 동시 수정을 처리합니다.
- 날짜는 계정 시간대로 고정합니다. 시간대 변경이나 습관 삭제는 과거 날짜 스냅샷을 다시 쓰지 않습니다.
- 앱이 열려 있을 때만 알림을 제공합니다. 테마는 기기별 설정입니다.
- 로그아웃 전에 미전송 작업이 있으면 백업과 확인을 제공합니다. 로그아웃 시 해당 회원 캐시를 지우고 비회원 공간으로 돌아갑니다.
- 백업 복원은 기록이 없는 같은 계정/비회원 공간에서만 허용합니다. 기존 데이터를 덮어쓰는 복원은 거부합니다.

[구현·PR 구분 및 테스트 기준](docs/implementation.md) · [운영·롤백 절차](docs/operations.md)

[PR #3 리뷰 보완·검증 보고](docs/pr3-review.md)에서 가져오기 완료 조건, 상태 표시, 업그레이드·롤백 주의사항을 확인하세요.

[STEP 02 연결·통합 검증 보고와 기존 v0 App 설정 절차](docs/step02-validation.md)를 확인하세요. 로컬 Supabase 검증과 실제 호스팅 프로젝트·배포 검증 상태를 구분합니다.
