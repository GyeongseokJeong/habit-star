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

## STEP 3 — Android 뒤로가기·시스템 바·재진입 (실기기 검증 전)

`mobile/native/MainActivity.java.template`는 **디버그용 네이티브 코드**입니다.
`npm run android:sync`가 Capacitor 프로젝트 동기화 후
`mobile/scripts/patch-android.mjs`로 생성된 `MainActivity.java`를
자동 보완합니다. 기본 안내 APK와 기존 웹을 연결한 앱 APK 모두 동일하게 적용합니다.
웹 운영 사이트, Supabase 인증/데이터 및 웹 자산은 변경하지 않습니다.

뒤로가기 우선순위:
1. `dialog[open]`이 있으면 계정 상세 화면의 `내 계정으로` 버튼
   (`.modal-back`)을 우선 호출합니다.
2. 일반 모달이면 기존 React `닫기` 버튼을 호출하여 웹 상태를 정상 해제합니다.
3. 열린 모달이 없으면 WebView의 실제 방문 기록 `canGoBack()`으로 이동합니다.
4. 돌아갈 방문 기록이 없으면 `finish()`로 Android 런처에 복귀합니다.
   네이티브 코드에서 기록 삭제, 로그아웃, 브라우저 저장소 초기화를 하지 않습니다.

시스템 바: 앱이 **전경에 있는 동안만** WebView에서 현재 별하루 테마를 읽어,
Android 상태바/내비게이션 바의 아이콘을 라이트 테마면 어둡게,
다크 테마면 밝게 표시합니다. Android edge-to-edge 영역의 배경을
강제로 덮거나 웹 UI 색상을 변경하지 않습니다.

재진입: `onResume()`에서 테마 대비 확인을 다시 시작하고,
`onPause()`/ `onDestroy()`에서는 정지합니다. WebView를 명시적으로
새로고침하거나 백그라운드에서 별도 동기화를 강제하지 않습니다.
Android가 프로세스를 종료하는 상황까지 데이터 무손실이 확인된 것은 아닙니다.

### STEP 3 Galaxy 확인 항목
- [ ] 습관 추가/수정/실천기록/별자리 팝업에서 Android 뒤로가기 → 기존 닫기 동작
- [ ] 계정 → 앱 설정 등 상세 화면에서 뒤로가기 → 내 계정, 다시 뒤로가기 → 홈
- [ ] 홈페이지에서 Android 뒤로가기 → 런처 복귀 (기록 초기화 없음)
- [ ] 다크 ↔ 라이트 전환 후 상태바의 시계/아이콘 및 하단 내비게이션 바 대비
- [ ] 홈 화면 → 앱 전환 → 다시 앱 진입, 스크롤·비회원 기록 보존
- [ ] 키보드 표시 중 뒤로가기 및 화면 회전/다크모드 변화 비교
- [ ] Chrome/PWA/운영 사이트의 변경이나 회귀가 없는지 확인

`npm run check`는 Java 템플릿 내부 JS 동작(열린 모달/테마 판독)을
Node에서 검증하고, Android CI는 실제 네이티브 Java 컴파일을 확인합니다.
**디버그 APK 빌드 성공은 실기기 동작 합격을 대체하지 않습니다.**

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
