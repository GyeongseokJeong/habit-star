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

**APK 설치 주의:** GitHub Actions에서 생성하는 debug APK는 실행마다 임시 디버그
서명키가 달라질 수 있습니다. 기존 `별하루 WebView PoC`에 덮어쓰기 설치가
거부되면 이전 APK를 제거해야 할 수 있고, **앱 삭제 시 WebView의 테스트 기록도
삭제됩니다.** 필요한 테스트 데이터는 먼저 별하루 자체 백업 기능으로 내보내세요.
중요한 개인 기록을 PoC에 사용하지 않는 원칙은 계속 유지합니다.

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

## STEP 4 — 독립 Android 로컬 알림 PoC (실기기 확인 전)

**기존 운영 웹사이트/계정/습관 데이터/앱 설정을 변경하지 않습니다.**
별도의 앱 ID `io.github.gyeongseokjeong.byeolharu.notificationpoc`를 가진
`별하루 알림 PoC`를 만들고, Capacitor Local Notifications 8.3.1을
네이티브 Android 프로젝트에 동기화합니다. 원격 `server.url`을 사용하지
않으며, 단독 번들 `notifications/` 화면만 열립니다.

GitHub Actions `Android Shell PoC`의
`android-local-notification-poc` 작업이 성공하면
`byeolharu-android-notification-debug` 산출물을 받을 수 있습니다.

### Galaxy 테스트 절차

1. 새로운 알림 PoC APK를 설치합니다. 이전 WebView PoC와 **별도 앱**이며
   두 앱을 함께 설치할 수 있습니다.
2. **알림 권한 확인·요청**을 누르고, 팝업이 나타나면 허용합니다.
   거부했다면 Android 설정에서 직접 허용 여부를 확인합니다.
3. **30초 후 테스트 알림 예약**을 누릅니다. 예약된 시각이 화면에 나타납니다.
4. 홈으로 나가 30초 정도 지난 뒤 알림 패널에서 별하루 알림을 확인합니다.
   Android 배터리 절전/Doze/기기 제조사 정책 때문에 정확한 30초 전달은 보장하지
   않으며, 늦거나 전달되지 않으면 실제 시간을 기록합니다.
5. 다시 실행해 **예약된 알림 확인** 및 **예약 취소** 기능을 점검합니다.
6. 알림 권한을 끈 뒤 예약 요청했을 때 앱이 무리하게 진행하지 않는지 확인합니다.

실기기에서 확인할 결과: [ ] 권한 요청, [ ] 백그라운드 수신,
[ ] 앱 종료 후 수신, [ ] 예약 취소, [ ] 거부 시 안내, [ ] 재부팅 후 동작(후속).

이 실험은 **테스트 알림 ID 7301 한 건만** 예약하며 같은 ID를 새 예약 전에
취소합니다. 기존 알림을 관리하거나 실제 습관별 알림을 예약하지 않습니다.
정밀 알람 권한은 요청하지 않습니다. 정해진 시각의 습관 알림,
요일 반복, 시간대 변경, 앱 재부팅 후 복구, 데이터 이전 등은
실기기 검증 후에 설계합니다.

로컬 재현은 새 `android/` 프로젝트에서:
```sh
cd mobile
npm install --no-package-lock
BYEOLHARU_POC_NOTIFICATIONS=1 npm run notifications:prepare
BYEOLHARU_POC_NOTIFICATIONS=1 npm run android:init
BYEOLHARU_POC_NOTIFICATIONS=1 npm run android:sync
BYEOLHARU_POC_NOTIFICATIONS=1 npm run android:open
```
이 모드는 `mobile/www/index.html`을 일시적으로 알림 테스트 화면으로
교체합니다. GitHub Actions는 일회용 체크아웃에서 수행하므로 웹 운영 자산이나
다른 앱에 전파되지 않습니다. 개발 머신에서는 원래 파일을 Git에서 복원하거나
별도 작업 디렉터리를 이용하세요.

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
