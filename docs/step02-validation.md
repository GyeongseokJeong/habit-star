# STEP 02 — 실제 연결 준비와 통합 검증

검증일: 2026-11-10. 기준: 최신 `main`의 `1569a55f0da3885be91a88dcda38a8a68e084888` (PR #3 병합). 작업 브랜치: `codex/byeolharu-v2-step02`.

## 완료 상태와 경계

| 항목 | 상태 | 증거 또는 남은 조건 |
| --- | --- | --- |
| 기존 인증·저장소·동기화 구현 | 기존 구현 재사용 | 이번 변경은 브라우저 회귀 테스트와 배포 절차 문서 |
| 로컬 Supabase 연결 | 검증 | Docker PostgreSQL + Auth + Mailpit에 실제 HTTP 연결, 마이그레이션 이력 001/002/003 확인 |
| 호스팅된 개발·테스트 Supabase | 미연결 | 프로젝트 URL, 공개 키, 프로젝트 참조 및 관리 권한이 제공되지 않음 |
| 이메일 가입·확인·로그인·재설정 | 로컬 검증 | Mailpit 메일 링크를 실제 브라우저로 실행. 운영 SMTP 수신·전달률은 미검증 |
| 사용자별 격리·RPC 권한 | 로컬 검증 | SQL RLS/ACL/소유권 테스트 + 브라우저 A/B 계정 전환 |
| v1 이전·충돌·재시도 | 로컬 검증 | 원본 네 키 보존, 명시적 동의, 재가져오기, 충돌 및 인증 만료 회귀 테스트 |
| 두 기기 동기화 | 로컬 검증 | 독립 Chromium 컨텍스트 두 개, 별점·메모·습관 수정·오프라인·충돌 해결 |
| GitHub Actions | 원격 결과 미확인 | API 접근 제한으로 실행 결과 확인 불가. 로컬 실행 결과와 별개 |
| 기존 v0 App 설정·서비스 도메인 | 미확인 | 접근 권한/연결 설정 없음. 저장소에서 실제 운영 도메인을 확인할 수 없음 |
| 실제 배포·클라우드 공개 | 미실행 | 사용자 승인 및 아래 외부 환경 검증 필요 |

로컬 Supabase는 호스팅된 Supabase 연결의 증거가 아닙니다. `test:e2e:cloud`는 안전하게 로컬 `localhost/127.0.0.1:54321`만 허용하므로 원격 프로젝트 검증을 대신하지 않습니다. 기존 운영 환경은 변경하지 않았으며 클라우드를 켜지 않았습니다.

## 코드 검토 결과

- `lib/supabase/{client,server,redirect}.ts`, `proxy.ts`, `app/auth/confirm/route.ts`: 브라우저/서버 클라이언트 분리, 쿠키 갱신, no-store, canonical origin 및 제한된 복귀 경로. 프로덕션 콜백은 명시적인 HTTPS `NEXT_PUBLIC_SITE_URL`이 필요합니다.
- `components/account/account-panel.tsx`, `app/auth/reset`: 가입·확인·로그인·재설정·로그아웃 구현이 존재합니다. 기존 비회원 화면을 유지하며 로그인 강제 화면을 추가하지 않습니다.
- `lib/habits/repository.ts`, IndexedDB: 비회원/회원 scope, 원본 백업, 트랜잭션 기반 기록+Outbox, 계정 전환 격리를 재사용합니다. v1 네 키를 덮어쓰거나 삭제하지 않습니다. IndexedDB/브라우저 저장소는 같은 origin에서만 유지됩니다.
- `lib/habits/sync.ts`, `sync-status.ts`: 검증한 사용자 토큰 고정, 초기 서버 스냅샷 및 마지막 성공 상태, 재전송 ID, 버전 비교와 충돌 해결을 재사용합니다. 빈 Outbox만으로 성공을 판정하지 않습니다.
- 가져오기: 동의 전 건수/날짜 표시 → 원본 고정/journal → staging → `applied` 및 `verified:true` → 독립 서버 재조회와 로컬 일치 확인 → 완료. 충돌·실패·인증 만료를 구분하고 원본과 같은 작업 ID를 유지합니다. PR #3 회귀 테스트를 유지했습니다.
- SQL 001/002/003: 사용자 복합 소유권 FK, RLS, 직접 쓰기 제한, `auth.uid()` 기반 Security Definer RPC, 빈 `search_path`, 비공개 helper 권한, 멱등성 및 가져오기 검증을 검토했습니다. 기존 마이그레이션 수정·DB reset은 하지 않았으며 후속 마이그레이션이 필요한 애플리케이션 결함은 이번 검증에서 발견하지 못했습니다.
- `.github/workflows/ci.yml`: 타입/단위/새 PostgreSQL 업그레이드/빌드/production PWA/비회원/로컬 Supabase 브라우저 테스트를 실행합니다. v0 배포나 운영 DB 변경 작업은 없습니다. 추가한 테스트도 기존 cloud job에서 자동 실행됩니다.
- `app/layout.tsx`, `public/sw.js`: 글꼴은 Fontsource 패키지에 고정되어 Google Fonts 다운로드에 의존하지 않습니다. SW는 인증·개인 응답 대신 오프라인 앱 셸을 사용합니다. 실제 v0 CDN/HTTPS/SW 업데이트 동작은 배포 후 검증 대상입니다.

## 추가한 검증

`tests/e2e/cloud.spec.ts`:

1. 기존 두 브라우저 테스트에 A의 메모 저장 → 서버 동기화 성공 확인 → B의 명시적 동기화 → 동일 메모 표시를 추가했습니다.
2. 이메일 인증 후 새로고침해도 계정이 유지되고, 로그아웃 후 잘못된 비밀번호는 오류와 비회원 상태를 유지하며, 정상 비밀번호로 로그인되는지 검증합니다.
3. v1 습관 설정·과거 별점·메모를 가진 사용자가 회원가입해도 자동 이전되지 않는지, 건수를 확인하고 동의한 뒤 검증 완료되는지 확인합니다. 두 번 가져온 뒤 각각 백업을 검사하여 같은 습관/과거 기록이 한 개이며 원본 네 키가 바이트 그대로인지 검증합니다.

애플리케이션 기능·기존 SQL·클라우드 기본값은 바꾸지 않았습니다. 이 테스트 보강은 새로운 기능 구현 완료를 의미하지 않습니다.

## 실제 실행 결과

| 명령 | 실제 결과 |
| --- | --- |
| `pnpm typecheck` | 통과 (최종 테스트 변경 후 재실행) |
| `pnpm test` | 5개 파일, 39개 테스트 통과 |
| `pnpm test:db` | 실행 중인 로컬 Supabase에서 SQL 3개 suite 통과 |
| `pnpm test:db --postgres` | 별도 PostgreSQL 17에서 새 설치 + 001→003 업그레이드 보존 fixture + SQL 3개 suite 통과 |
| `pnpm test:e2e` | 비회원 브라우저 테스트 5개 통과 |
| `pnpm test:e2e:cloud` | 로컬 Auth/Mailpit/PostgreSQL 연결 브라우저 테스트 7개 통과 (최종 검증 1.1분) |
| `pnpm build` | Next.js 16.4.5 production 빌드 통과, Google Fonts 다운로드 없음 |
| `pnpm test:e2e:production` | production 글꼴·SW·오프라인 편집 보존 테스트 1개 통과 |

요청한 8개 로컬 명령은 모두 종료 코드 0입니다. 해당 명령 중 실패/미실행은 없습니다. 호스팅 Supabase/실제 운영 SMTP/v0 재배포 검증은 환경이 없어 미실행입니다. GitHub REST·GraphQL API는 모두 `403 Forbidden`으로 PR 생성과 CI 조회가 차단되며, 로컬 테스트 통과를 GitHub CI 통과로 표시하지 않습니다.

변경 파일의 secret/JWT/개인 토큰/개인키 패턴 검사와 diff 검토에서 실제 자격증명은 발견되지 않았습니다. 실제 URL·키·토큰·사용자 백업·테스트 로그·로컬 env 파일은 커밋에 포함하지 않습니다.

테스트 환경은 Node 24.22.1, pnpm 11.25.0, 시스템 Chromium입니다. 실행 시 `NEXT_TELEMETRY_DISABLED=1`, 브라우저 명령에는 `CHROMIUM_PATH=/usr/bin/chromium`을 사용했습니다. `--postgres`는 전용 일회용 컨테이너에 001→002→003과 이전 오류 상태 fixture를 적용하고 보존·재개를 검증한 뒤 해당 컨테이너만 제거합니다. 기존 Supabase DB는 초기화하지 않습니다. SQL 테스트의 fixture는 트랜잭션 종료 시 rollback됩니다.

`test:e2e:production`은 클라우드 비활성 로컬 production 서버의 PWA/비회원 회귀 테스트입니다. 호스팅 Supabase에 연결한 프로덕션 인증 빌드는 별도 검증해야 합니다. 실제 JWT 장기 만료/자동 갱신, 모바일 브라우저, 운영 SMTP 및 CDN 캐시도 미검증입니다. 세션 만료 회귀 테스트는 제어한 401 응답과 계정 전환 경쟁을 사용합니다.

## 테스트용 Supabase 연결 절차 — 사용자가 보안 설정 화면에서 수행

1. 기존 개발·테스트 프로젝트를 먼저 선택합니다. 운영 프로젝트와 분리됐는지 확인합니다. 새 프로젝트 생성이나 운영 DB 변경은 이번 작업에서 수행하지 않았습니다.
2. 프로젝트 대시보드에서 Project URL, **Publishable key**를 확인합니다. Secret/Service Role key와 개인 접근 토큰을 `NEXT_PUBLIC_*`, 코드, Git, 채팅에 넣지 않습니다. 관리용 자격증명은 CLI 보안 로그인/플랫폼 secret 설정에서만 취급합니다.
3. 백업/PITR 지원·보존 기간·복원 가능 시점을 확인하고 별도 테스트 DB에서 복원 절차를 검증합니다. 테스트 DB에 운영 사용자 기록을 무단 복제하지 않습니다.
4. 관리자 환경에서 프로젝트 ref를 재확인하고 CLI를 연결한 뒤 이력을 읽습니다. 아래 명령은 v0의 빌드 명령에 넣지 않습니다.

   ```sh
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <확인한-테스트-project-ref>
   pnpm exec supabase migration list --linked
   pnpm exec supabase db push --linked --dry-run
   ```

5. 원격 이력과 스키마를 함께 비교합니다. 기존 SQL Editor 적용으로 이력이 비어 있거나 부분 적용됐다면 즉시 중단하고 실제 객체와 적용본을 대조합니다. 단순히 이력을 강제 완료로 표시하거나 이미 적용된 SQL을 다시 실행하지 않습니다. 정상 이력에서 미적용 파일만 `001_cloud` → `002_import_integrity` → `003_input_validation` 순서인지 검토한 뒤, **테스트 대상임을 재확인하고** `pnpm exec supabase db push --linked`를 실행합니다. reset·데이터 삭제·기존 마이그레이션 편집은 금지합니다.
6. Auth 이메일 가입과 이메일 확인을 켜고 아래 Site/Redirect URL을 등록합니다. 개발 Mailpit과 실제 테스트 SMTP를 구분합니다. 호스팅 환경에서는 SMTP 발송 제한·허용 수신자·메일 템플릿·가입/복구 링크를 실제 수신함에서 확인합니다. 로컬 메일 링크 통과를 운영 SMTP 통과로 기록하지 않습니다.
7. 로컬에서만 `.env.example`을 **Git에서 무시되는** `.env.local`로 복사하고 해당 테스트 프로젝트의 값으로 설정합니다. `pnpm dev`를 다시 시작합니다. 공개 키가 있다고 해서 RLS를 생략할 수 없습니다.
8. 아래 수동 시나리오를 테스트 프로젝트에 대해 실행하고 프로젝트 ref, 배포 commit, 도메인, 시각, 성공/실패 및 비식별 증거를 운영 기록에 남깁니다. 메일·JWT·사용자 기록 원문을 PR/CI 로그에 첨부하지 않습니다.

## 환경변수와 인증 URL

| 변수 | 로컬 개발/테스트 | 기존 v0 운영 환경 |
| --- | --- | --- |
| `NEXT_PUBLIC_CLOUD_ENABLED` | 검증할 때만 `true` | 승인 전 기존 상태 유지/비활성 `false` |
| `NEXT_PUBLIC_SUPABASE_URL` | 선택한 테스트 프로젝트 URL | 승인된 운영 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 해당 테스트 프로젝트 공개 키 | 해당 운영 프로젝트 공개 키 |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | 기존 서비스의 실제 HTTPS origin |

`NEXT_PUBLIC_*`는 브라우저 번들에 공개되고 빌드 시점에 반영됩니다. 값을 바꾼 뒤 재빌드/재배포해야 하며 런타임 값만 바꿔 즉시 켜거나 끌 수 있다고 가정하지 않습니다. `.env.local`과 실제 키를 커밋하지 않습니다.

Supabase Auth URL Configuration:

| 설정 | 로컬 | 기존 서비스 |
| --- | --- | --- |
| Site URL | `http://localhost:3000` | 기존 배포 설정에서 확인한 HTTPS origin |
| Redirect URL (가입/확인) | `http://localhost:3000/auth/confirm` | `<확인한 HTTPS origin>/auth/confirm` |
| Redirect URL (복구) | `http://localhost:3000/auth/confirm?next=/auth/reset` | `<확인한 HTTPS origin>/auth/confirm?next=/auth/reset` |

위 꺾쇠 표기는 입력할 실제 URL이 아닙니다. 운영 도메인은 현재 확인되지 않았으므로 임의의 도메인을 등록하지 않습니다. 로컬 `127.0.0.1`을 사용한다면 origin과 콜백 허용 목록도 같은 호스트로 맞춥니다. 운영 프로젝트에는 개발/preview wildcard URL을 편의상 추가하지 말고 환경별로 분리합니다. 가입과 복구 콜백이 의도한 환경으로만 돌아오는지 확인합니다.

## 기존 v0 App 재배포 준비 체크리스트

- [ ] 기존 v0 App 프로젝트와 현재 HTTPS 도메인, GitHub 저장소/연결 브랜치를 확인한다. 별도 Vercel/호스팅 프로젝트를 만들지 않는다.
- [ ] 기존 v0 빌드가 저장소의 Node `>=24.22.1 <25`, pnpm `11.25.0` 및 `pnpm build`를 지원하는지 확인한다. 현재 플랫폼의 런타임 설정은 직접 확인하지 못했다.
- [ ] 기존 사용자에게 같은 origin이 유지되는지 확인하고 비회원/회원 기록 백업을 확보한다. 브라우저 저장소 삭제나 강제 로그아웃을 배포 절차에 넣지 않는다.
- [ ] v0에만 남은 미동기화 편집이 없는지 diff로 확인한다. 충돌 시 현재 GitHub 변경과 대조하여 수동 해결한다.
- [ ] 테스트용 Supabase에서 아래 인증/격리/이전/두 기기 시나리오를 통과시키고 운영 DB 백업/이력/스키마를 확인한다.
- [ ] 기존 프로젝트의 올바른 환경 범위에 URL/Publishable key/Site URL을 설정하고 **Cloud는 승인 전 비활성**으로 유지한다. secret key를 프론트 설정에 넣지 않는다.
- [ ] Supabase에 정확한 HTTPS 콜백과 복구 URL, 운영 SMTP를 설정한다.
- [ ] STEP 02 PR 코드 리뷰와 GitHub CI 성공을 확인한다. 이 작업은 main 병합을 수행하지 않는다.
- [ ] 승인 후 운영자가 main 병합 → 기존 v0 App GitHub Sync → 변경 검토 → 재빌드/재배포한다. v0 빌드에서 Supabase CLI/DB migration/reset을 자동 실행하지 않는다.
- [ ] 기존 URL에서 먼저 비회원 데이터·PWA를 확인한다. DB/인증 환경 검증과 공개 승인 후에만 `CLOUD_ENABLED=true`로 다시 빌드한다.
- [ ] 실제 배포에서 아래 수동 검증을 완료하고 각 결과를 기록한다. 실패 시 즉시 공개 확대를 중단한다.

## 실제 환경에서 남은 수동 검증

- 이메일: 신규 가입 → 실제 수신함 확인 링크 → 로그인 → 오입력 오류 → 새로고침 세션 → 복구 메일 → 새 비밀번호 → 로그아웃 → 접근 차단. 실제 토큰 만료/갱신·만료 중 가져오기 재인증도 확인합니다.
- 비회원: 로그인 없이 생성·수정·삭제·별점·메모·통계, 새로고침 및 오프라인 재진입. 개발자 도구에서 비회원일 때 개인 데이터가 서버에 업로드되지 않는지 확인합니다.
- 데이터 이전: v1 네 키가 있는 별도 브라우저에서 백업 → 가입 → 자동 업로드 없음 → 습관/날짜/기록 수 확인과 동의 → 과거 별점/메모/설정 비교 → 재시도/중복 없음 → 원본 유지. 서버에 같은 ID의 다른 기록을 준비해 충돌 시 완료로 표시되지 않는지 확인합니다. 전송 중 네트워크 차단·복구, 검증 실패·세션 만료 후 같은 배치 재개도 확인합니다.
- 계정 격리: A/B 별도 계정으로 타인의 읽기/쓰기/습관 ID 참조를 거부하는지 확인합니다. publishable key만 가진 미인증 요청과 A 토큰의 B 조회/RPC, 직접 DML 및 private helper 실행이 차단되는지 테스트 DB에서 확인합니다. 관리자 토큰으로 격리 테스트를 대신하지 않습니다.
- 두 기기: 독립 브라우저 A/B에서 같은 계정으로 습관 생성 → 조회 → 별점/메모 양방향 전달 → 한쪽 오프라인 편집 → 복구 → 같은 기록 동시 수정 충돌 → 명시적 선택 → 양쪽 일치. 대기/실패/완료 상태와 서버의 실제 값을 함께 확인합니다. 로그아웃 뒤 다른 계정의 캐시·Outbox·기록이 노출되지 않아야 합니다.
- 배포: 실제 HTTPS에서 콜백·쿠키·새로고침·proxy·CDN no-store, 기존 SW에서 신규 SW 업데이트, PWA 설치/오프라인/재연결, 자체 글꼴 로딩을 확인합니다. 로컬 production 테스트가 v0의 CDN/브라우저 환경을 대신하지 않습니다.

## 중단과 롤백

계정 간 노출, 기록 누락/원본 변경, 검증되지 않은 가져오기 완료는 한 건이라도 중단 기준입니다. [운영·롤백 절차](operations.md)의 `private.sync_controls` 관리자 쓰기/import 중단으로 Outbox를 보존한 채 서버 변경을 막을 수 있습니다. 관리 권한에서만 실행하고 사용자 데이터를 삭제하지 않습니다. 신규 가입 중지는 Auth에서 별도 제어합니다.

클라우드 비활성화는 환경변수 `false`와 **재빌드/재배포**가 필요합니다. 비활성화는 서버 데이터나 회원 Outbox를 삭제하지 않지만 비회원 화면으로 돌아가므로 회원의 미전송 작업을 먼저 백업하고 재활성화/복구 안내를 준비합니다. 장애 시 마지막으로 검증된 **v2 호환** 배포로 되돌리고 002/003 보정 및 서버 원본/journal을 유지합니다. 최초 v1 코드로 직접 롤백하거나 DB를 다운그레이드/reset하지 않습니다. IndexedDB, localStorage, staging, 충돌 사본을 보존하고 복구 후 계정 격리와 서버/로컬 일치를 재검증합니다.

## 다음 단계 판단

로컬 통합 테스트 통과는 코드 리뷰를 진행할 근거입니다. 호스팅된 테스트 Supabase/실제 SMTP/기존 v0 도메인·설정·GitHub CI 확인이 끝나기 전까지 STEP 02 외부 환경 검증과 실서비스 공개는 미완료입니다. 본 변경은 배포나 클라우드 공개 승인을 대신하지 않습니다.
