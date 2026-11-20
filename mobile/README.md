# 별하루 Android 셸 PoC (Capacitor 8)

**이 폴더는 Play Store 출시용 앱이 아닙니다.** 기존 웹 서비스 `main`과 별개인
`app/feat/android-shell-poc`에서 Android WebView/뒤로가기/저장소 경계를 검증하는 실험입니다.

## 구조와 선택 이유
- 웹 앱은 Next.js 서버에서 Supabase 인증 콜백과 쿠키를 처리합니다. 지금의
  `next build` 출력물을 곧바로 Capacitor의 로컬 `webDir`로 사용할 수 없습니다.
- `www/index.html`은 네트워크 요청이나 계정 접근이 없는 **안내 화면**입니다.
  `server.url`은 기본값에 없으며 테스트 URL을 **명시적으로** 설정한 경우에만
  별도의 HTTPS 웹 UI를 열어 줍니다. 이 기능은 Capacitor의 라이브 개발 기능으로,
  출시 구조가 아닙니다.
- Android 플랫폼 프로젝트는 아직 의도적으로 커밋하지 않습니다. CLI로 생성해
  디버그 APK가 빌드되는지 검증하는 단계입니다. 추후 앱 아키텍처 확정 뒤
  `android/` 프로젝트와 Gradle wrapper를 Git에 포함해야 합니다.

## 실행 (Node 24.22.1 / Android Studio 2025.2.1 이상)
```sh
cd mobile
npm install --no-package-lock
npm run check
npm run android:init
npm run android:sync
npm run android:open
```
Android Studio에서 에뮬레이터 또는 실제 Android 디바이스에 **debug** 빌드를
설치합니다. 초기 앱은 계정이 없는 안내 화면만 보여야 합니다.

### 원격 웹 UI 확인 (의도적으로 실험할 때만)
```sh
# 모바일 개발/테스트용 HTTPS 배포 주소만 사용. 실사용 계정 입력 금지.
BYEOLHARU_POC_REMOTE_DEBUG=1 \
BYEOLHARU_POC_URL=https://your-test-deployment.example \
npm run android:sync
npm run android:open
```
Android Studio에서 다시 디버그 앱을 실행합니다. 테스트 후 아래처럼 **원격 로딩을
해제**하고 다시 sync 해 기본 안내 화면으로 돌려놓습니다.
```sh
unset BYEOLHARU_POC_REMOTE_DEBUG BYEOLHARU_POC_URL
npm run android:sync
```
환경변수가 없으면 `server.url` 자체가 생성되지 않습니다. 설정은 HTTP,
쿼리/프래그먼트/경로가 붙은 URL, 인증정보가 포함된 URL을 거부합니다.

## STEP 2 — 실제 별하루 홈을 WebView에서 확인하는 APK

기존 안내 화면을 대체하는 **두 번째 디버그 APK**는 별도의 테스트용 HTTPS 웹 배포가
준비된 경우에만 생성됩니다. 스테이징이 없거나 보호되어 있으면 기본 PoC만 계속
빌드합니다. 운영 `habit-star-fawn.vercel.app`은 PoC 연결 대상으로 **허용하지 않습니다**.

1. 테스트용 별하루 웹 배포를 준비합니다. 현재 Vercel은 `main` 외 브랜치의 자동
   Preview 배포가 비활성화되어 있으므로 **Vercel Preview 주소가 자동으로 생긴다고
   가정하지 않습니다**. 운영 서비스를 재설정하거나 Production에 배포하지 마세요.
   스테이징 주소가 아직 없다면 이 단계는 보류합니다.
2. 해당 HTTPS 주소를 비회원 브라우저에서 직접 열어 홈이 정상 표시되는지 확인하고,
   Supabase 운영 프로젝트·운영 계정과 연결되지 않는 **독립 테스트 환경**인지 확인합니다.
   비밀번호·토큰·실사용 기록은 테스트에 사용하지 않습니다.
3. GitHub 저장소 `Settings → Secrets and variables → Actions → Variables`에서
   **`BYEOLHARU_APP_STAGING_URL`** 변수를 설정합니다.
   예: `https://example-staging.example` (실제 주소로 대체, 끝의 `/`는 선택).
   이 값은 인증 비밀이 아닌 공개 웹 주소이며 GitHub 저장소 작업에 노출될 수 있습니다.
4. `app/feat/android-shell-poc`에 새 커밋이 들어오면
   `Android Shell PoC` 워크플로가 두 아티팩트를 빌드합니다:
   - `byeolharu-android-shell-debug-poc`: 기존 오프라인 안내 화면
   - `byeolharu-android-webview-preview-debug`: **검증된 스테이징 별하루 홈페이지**를
     여는 원격 WebView 실험 APK
5. 워크플로의 `android-webview-preview` 작업은 익명 GET으로 HTTP 200 HTML과
   ‘별하루’ 문구를 확인하고, 프로덕션 주소·HTTP·URL 경로/쿼리가 있으면 빌드를
   중단합니다. 검증 성공 후에만 원격 주소가 들어간 디버그 APK를 생성합니다.
6. APK를 갤럭시에 설치하여 홈, 스크롤, 탭 전환, 별점, 시스템 뒤로가기,
   앱 종료 후 재진입을 확인합니다. **테스트용 비회원 습관만** 사용합니다.
   정상 동작과 WebView의 로그인·저장소 안정성이 입증되기 전에는 운영용이 아닙니다.

스테이징 URL 변수를 제거하면 다음 실행부터 원격 APK 생성이 자동 생략됩니다.
GitHub CI에서 생성된 원격 APK를 설치한 뒤에는 이미 설치된 APK의 주소가
바뀌지 않으므로, 실험 종료 후 APK를 삭제하거나 기본 APK로 다시 설치하세요.

### STEP 2 검증 체크리스트

- [ ] 독립 스테이징 HTTPS 도메인 준비 및 운영 Supabase와 격리 확인
- [ ] GitHub 변수 등록 및 `android-webview-preview` 작업 성공
- [ ] 실제 홈 화면과 라이트·다크/푸터가 Galaxy WebView에서 정상 표시
- [ ] 리스트 스크롤, 습관 생성, 별점 취소, 탐색, 뒤로가기
- [ ] 테스트용 비회원 기록이 앱 종료·재실행 후 유지되는지 확인
- [ ] 네트워크 차단 시 화면/기록 동작 관찰 (원격 사이트이므로 오프라인 보장 안 됨)
- [ ] 앱을 제거했다 다시 설치한 경우 기록이 보존된다고 **가정하지 않기**
- [ ] 로그인, 이메일 인증, 운영 DB 동기화, 네이티브 알림은 후속 검증으로 분리

**주의:** `server.url`은 Capacitor 개발 실험 옵션으로 사용합니다. HTTPS라도
앱 콘텐츠를 네트워크에서 직접 받아오기 때문에 정식 앱 출시 아키텍처가 아니며,
앱과 웹의 저장소/세션 분리를 먼저 설계해야 합니다.

## 지금 검증할 것
| 영역 | 합격 기준 |
|---|---|
| Native 셸 | 디버그 APK 생성, 첫 실행 후 안내 화면 출력 |
| 화면 | 상태바/하단 시스템 바/폰트/안전 영역/세로 회전 확인 |
| 네비게이션 | 물리·제스처 뒤로가기 동작 기록, 앱 종료 흐름 정의 |
| 저장소 | WebView IndexedDB는 일반 Chrome/PWA와 **별개**. 테스트용 습관으로 앱 종료/재실행 후 보존 여부만 확인 |
| 인증 | **미검증**. 이메일 링크는 외부 브라우저에서 열릴 수 있으므로 현재 로그인·회원 데이터·비밀번호 재설정에 사용 금지 |
| 푸시/알림 | **미구현**. 로컬 알림 권한/정확도/재부팅·배터리 제한은 후속 별도 PoC |

## 현재 보류/금지
- 운영 `main`, Vercel, Supabase DB, RLS, Auth 리디렉션은 변경하지 않습니다.
- production 도메인/계정 및 원본 습관 기록으로 데이터 보존 테스트 금지.
- `server.url` 원격 셸을 그대로 정식 출시하지 않습니다. 정식 배포 전
  **로컬 앱 자산 + 안정적인 서버 API / 인증 딥링크 / 네이티브 저장소 / 오프라인**
  설계를 별도로 결정해야 합니다.
- 디버그 APK를 공개 배포하지 않습니다.

## 검사/CI
`npm run check`는 설정 구조만 검사합니다. `.github/workflows/android-poc.yml`은
이 브랜치에서 Node/npm 의존성 설치, Capacitor Android 플랫폼 일시 생성,
Gradle **debug** 빌드를 시도합니다. 웹 서비스 CI와 별도이며 실제 디바이스
화면/알림/인증은 검증하지 않습니다.

## 후속 결정 게이트
Android debug 빌드와 실제 WebView가 확인되면 `app/main` 병합 전에
1. 로컬 자산 기반 구성이 가능한지 Next.js 서버 기능을 분리하는 설계,
2. 테스트용 Auth 링크의 외부 브라우저→앱 딥링크와 쿠키 세션 보존,
3. 비회원 데이터의 WebView 격리와 백업·복원,
4. Android 뒤로가기·알림·오프라인/네트워크 장애 시나리오
를 별도 PR로 정리합니다.
