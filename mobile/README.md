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

## STEP 2 — 기존 별하루 운영 웹을 읽는 독립 Android 디버그 앱

별도 스테이징 웹 환경을 만들지 않고 **기존 공개 홈페이지**
`https://habit-star-fawn.vercel.app`을 Android WebView에서 표시합니다.
이 모드는 사용자가 요청한 초기 **화면/터치 검증용**이며 출시 구조가 아닙니다.
앱 컨테이너는 기존 오프라인 안내 앱과 서로 다른 Android applicationId를 사용해
동시 설치와 WebView 저장소 분리가 가능합니다.

- `byeolharu-android-shell-debug-poc`: 오프라인 안내 화면 APK (기본값)
- `byeolharu-android-existing-web-debug`: 실제 별하루 웹 홈페이지를 로드하는
  별도 *debug-only* APK (기본 모드와 다른 applicationId)

GitHub Actions `Android Shell PoC`의 두 작업은 각각 독립적으로 실행되며,
두 번째 작업은 **익명 GET 200/HTML 응답을 먼저 확인한 뒤에만** 빌드합니다.
별도 GitHub 변수, Vercel Preview 배포, 운영 웹 코드 또는 Supabase 환경변수
수정은 필요하지 않습니다.

직접 Android Studio로 확인할 경우:
```sh
cd mobile
npm install --no-package-lock
BYEOLHARU_POC_REMOTE_DEBUG=1 npm run android:init
BYEOLHARU_POC_REMOTE_DEBUG=1 npm run android:sync
BYEOLHARU_POC_REMOTE_DEBUG=1 npm run android:open
```
환경변수를 생략하면 로컬 안내 화면 모드로 돌아갑니다. 모드를 바꿔 빌드할 때는
새로 생성한 `android/` 폴더로 시작하거나 해당 모드 설정을 다시 sync하세요.

### 실기기 확인 범위
- [ ] 별하루 홈 화면/푸터 표시, 라이트·다크 전환, 세로 스크롤 및 탭 전환
- [ ] 별점·습관 입력 **비회원 테스트 데이터에 한정**, 앱 재실행 후 기록 유지
- [ ] Android 뒤로가기, 상태바·하단 내비게이션·키보드·안전 영역 확인
- [ ] 네트워크 끊김/재연결 후 화면 상태 확인 (원격 웹 로딩이므로 오프라인 보장 아님)
- [ ] 브라우저/PWA 기록이 앱 WebView에 자동 이동하지 않는 것을 확인
- [ ] 개인 계정 로그인, 비밀번호 재설정, 실제 회원 데이터 동기화는 이번 단계에서 하지 않음

**안전 주의:** 이 앱은 운영 웹에서 실제 제공 중인 JavaScript와 연결됩니다.
따라서 비회원용 더미 기록만 사용하며 운영 계정/개인 기록으로 테스트하지 않습니다.
테스트 중 기록은 WebView 전용 저장소에 남을 수 있습니다. 오류 확인 후 앱의
테스트 데이터는 별도 백업 필요 여부를 판단하여 직접 정리하세요.
앱 제거·재설치 후 저장소가 유지된다고 가정하지 않습니다.

Capacitor의 `server.url`은 라이브 개발/실험용 옵션이므로, 이 APK를 그대로
Play Store에 배포하지 않습니다. 본 PoC 이후 앱 자산을 번들링하는 출시 구조,
로그인 리디렉션, 앱별 데이터/복구 및 네이티브 알림을 각각 설계해야 합니다.

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
