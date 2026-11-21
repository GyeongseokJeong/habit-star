# 별하루 Android 개발 안내 (통합 이후)

> 2026-11-21: 웹과 Android는 **같은 `main` 소스**를 사용합니다. 아래 STEP 1~22 기록은 역사적인 실험 노트이며, 현재 병합·빌드 지침으로 사용하지 않습니다. Android 네이티브 알림 및 기존 테스트 앱 데이터 경계는 유지합니다.

## 현재 권장 빌드 경로
- 공통 React 화면·습관 로직·CSS는 `main`에서 관리합니다.
- 현재 사용자 검증 대상은 `android-packaged-guest-step9` 한 개이며, GitHub Actions의 **Android Shell PoC** 워크플로가 PR에서 해당 APK와 회귀 검사를 실행합니다.
- 수동 빌드는 GitHub Actions → Android Shell PoC → Run workflow → `main`을 선택하고, `legacy_diagnostics=false`(기본값)로 실행합니다.
- 과거 디버그/원격 WebView/알림 단독 실험 앱 5개는 통합 이후 제거되었습니다. 재현이 필요한 경우 Git 기록의 과거 커밋에서만 확인합니다. 실행 경로는 현재 지원하지 않습니다.
- APK artifact에는 `app-debug.apk`와 `build-info.json`이 들어 있습니다. JSON의 `sourceSha`는 실제 체크아웃된 커밋이며, `version`은 웹 루트 `package.json`과 같습니다.
- 웹과 Android의 앱 설정 하단에서 `플랫폼 · 버전 · 빌드 SHA`를 확인할 수 있습니다. 실제 설치 APK는 업데이트해야 새 버전이 반영됩니다.
- `main` push에서는 기존 웹 CI가 실행되고, Android APK는 **수동 실행 또는 PR 검사**로만 생성됩니다.

## 안전 정책
- 현재 패키징 앱은 **비회원 전용 테스트 APK**입니다. 클라우드 로그인·Supabase 연결은 의도적으로 꺼져 있습니다.
- 임시 `packagedgueststep9` Android applicationId와 디버그 서명을 바꾸거나 앱을 삭제하면 기존 테스트 기록이 이전되지 않을 수 있습니다.
- 별도 안정성 검증 전까지 Android 테스트 앱 데이터·알림 예약·정식 Play 서명·배포는 손대지 않습니다.
- 이전 `app/main` 대상 통합 scope 검사는 PR #120 이후 사용하지 않습니다. `main` 기준 공유 UI 경계 테스트와 빌드 메타데이터 검증을 사용합니다.
- 과거 Draft PR은 모두 종료되어도 브랜치와 기록은 안전 검토 후 별도로 정리합니다.

---

## 이전 Android 실험 기록 (참고용)

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

## STEP 5 / STEP 6 — 습관 알림 검증과 사용자 범위별 연결 준비

### STEP 5 독립 실기기 테스트

`app/feat/habit-reminder-scheduler-step5`의 별도 APK
`byeolharu-android-habit-reminder-step5-debug`를 설치하면 데모 습관의 반복
요일·예정 시간·당일 완료 취소를 검증할 수 있습니다. 시험용 알림은 수동
조작을 통해서만 예약하며, 운영 웹/인증/습관 데이터를 읽지 않습니다.
앱을 삭제하면 테스트 설정은 지워질 수 있으므로 반드시 더미 데이터로만
검증하세요. 8일 범위의 최대 48개 예약은 Android/배터리 정책에 따라 지연될
수 있습니다.

### STEP 6 연결 로직 (네이티브 앱에 연결하기 전 단계)

`notifications/scoped-reminder-runtime.js`는 웹과 별개로,
`LocalRepository.load()`가 제공하는 `Snapshot {day, habits}` 구조를
입력받는 순수 변환/예약 조정 모듈입니다.

1. `day`가 단말의 오늘과 일치하고 습관 데이터가 준비된 경우에만
   현재일의 `completed === true`를 인식하고 오늘 예약을 제외합니다.
   과거 달력 탭의 기록이나 인증 대기 중인 데이터를 대신 사용하지 않습니다.
2. 호출자가 검증한 `guest` 또는 `member:<user id>` 범위가 필수입니다.
   알림 ID는 범위별로 달라져 계정 간 예약이 섞이지 않도록 하고,
   사용자 전환/로그아웃 시 이전 범위를 명시적으로 취소해야 합니다.
3. `checkPermissions()`만 사용합니다. 자동 권한 팝업은 띄우지 않습니다.
   변경 없으면 재예약하지 않으며, 다른 앱/소유 범위의 예약은 취소하지 않습니다.
4. 동일 습관의 시간/반복 요일/완료 상태 변경은 다음 조정 시 반영합니다.
   시간대 오프셋 변화는 fingerprint 변경으로 재예약합니다. 앱 재개 또는
   단말 시간대 변경 이벤트에서 **앱 측이 별도로 호출해야** 합니다.
5. 오류나 예약 중단 시 자동으로 기존 습관 데이터·클라우드 Outbox를
   변경하지 않습니다. 네이티브 예약은 완전한 트랜잭션이 아니므로 이후
   재진입 시 재조정하며, 실패를 숨기지 않고 UI에 알려야 합니다.

**아직 실제 별하루에 연결되지 않았습니다.**
기존 Next.js 페이지는 인증 콜백과 서버 기능을 사용하므로, 현재의
`server.url` 원격 개발 WebView를 그대로 정식 앱으로 출시하지 않습니다.
독립 앱 자산을 번들링하고 사용자 권한·인증·오프라인 데이터를 안전하게
가져오는 출시 구조를 확정한 이후에만 다음 작업을 시작합니다.

### 출시 통합 시 필수 검증 게이트
- STEP 5 Galaxy 실기기 통과(요일별 수신/완료 후 취소/재예약/권한 거부)
- 알림 설정을 명시적으로 켠 사용자에게만 예약
- 계정 전환, 로그아웃, 기록 변경, 오프라인, 다중 기기 간 데이터 격리
- 재부팅 이후 예약 복구와 타임존/DST 변경, OS 절전 동작 테스트
- Android 패키징/인증 딥링크/키 관리 및 실제 회원 로그인 검증


## STEP 7 — opt-in 알림 수명주기 조정기 (아직 실서비스 미연결)

`notifications/reminder-lifecycle.js`는 STEP 6의 범위별 예약 엔진을 호출하는
독립 조정기입니다. **Android 출시 앱의 자동 실행에 연결되어 있지 않습니다.**
검증된 당일 Snapshot과 명시적으로 확인된 `guest` 또는 `member:<id>` 신원,
그리고 **사용자가 활성화한 optIn=true**일 때만 예약합니다. 권한을 자동으로
요청하지 않고, 다른 앱 및 STEP 4/5 데모 알림에는 영향을 주지 않습니다.

- `sync(context)`: 저장 완료 후 전달된 최신 Snapshot 기준 예약/수정/취소
- `onForeground(context)`: 앱 재진입 때 호출하도록 준비한 동일 동작
- `disable()`: 관리 중인 별하루 실제 알림만 취소 (기록은 그대로 보존)
- 계정 전환: 이전 범위의 대기 알림을 취소하고 새 범위만 예약
- 현재 날짜와 다른 스냅샷, 검증되지 않은 회원, opt-in 해제는 신규 예약을 하지
  않고 기존 관리 범위의 예약을 정리합니다
- 중복 호출은 직렬화하고 실행 대기 중 오래된 Snapshot은 예약하지 않습니다

### 남은 작업

앱의 사용자 식별 및 IndexedDB 상태를 단말의 검증된 Android 런타임에
연결하는 방법은 아직 확정되지 않았습니다. 기존 원격 WebView 개발 모드에
임의의 JavaScript 브리지나 인증 토큰 전달을 추가하지 않습니다. 출시형
패키징/로그인 리디렉션·알림 설정 UI/명시적 권한 동의/재부팅 복구/시간대 변경을
별도 검증해야 합니다. 운영 main·Supabase 데이터/스키마는 변경하지 않습니다.


## STEP 8 — Android 단독 통합 데모 (실제 회원 습관 미연결)

`BYEOLHARU_POC_NOTIFICATIONS=1` 및
`BYEOLHARU_POC_INTEGRATION_STEP8=1`을 함께 사용하면 독립 Android
패키지 `io.github.gyeongseokjeong.byeolharu.integrationstep8`를 생성합니다.
STEP 4/5 앱과 별개이며 실서비스 도메인이나 계정에 접속하지 않습니다.

데모 화면에서 습관 시간과 반복 요일을 바꾸거나 오늘 완료/취소하면
STEP 7 lifecycle → STEP 6 scoped reconciler → Capacitor Local Notifications
흐름으로 예약이 갱신됩니다. **알림 켜기**를 직접 누르고 OS 권한을 허용하기
전에는 신규 예약을 만들지 않습니다. 앱 재시작 시 데모 동의는 초기화되고
앱에 남은 관리 예약은 정리됩니다. 이 예제는 실제 별하루 DB/IndexedDB나
Next.js 화면에 연결하지 않으며 수신 정확도나 재부팅 복구는 보증하지 않습니다.

### 실기기 점검
- 권한 허용 후 '알림 켜기'로 예약 수 확인, 홈으로 이동 후 수신
- 시간 변경/반복 요일 변경 후 예약 갱신과 중복 방지
- '오늘 실천 완료'는 오늘 알림만 제외, 취소 시 재예약
- '알림 완전히 끄기' 후 예약 0건, 앱 재실행 후 초기화
- STEP 4/5 앱과 기존 WebView/PWA 데이터에 영향 없는지 확인

**이 단계는 실사용 Android 앱의 기능 연결 완료가 아닙니다.**
Next.js 서버 인증·회원 검증·저장소를 네이티브 번들로 연결하는 별도의
출시 아키텍처 검증이 남아 있습니다.


## STEP 9 — 실제 별하루 화면을 번들로 포함하는 비회원 APK (PoC)

이 단계는 기존 `components/byeolharu.tsx` React 화면과
`lib/habits/repository.ts`의 IndexedDB 기반 비회원 기록을 재사용합니다.
독립 앱 ID `io.github.gyeongseokjeong.byeolharu.packagedgueststep9`를
사용하고 앱 코드·CSS·이미지를 APK에 넣습니다. 테스트 중 사용하는 데이터는
이 APK 안의 비회원 저장 공간에만 기록되며, 기존 브라우저/PWA나 다른
Android 테스트 앱과 자동으로 공유되지 않습니다.

빌드 준비 시 **웹 루트에서** `pnpm install --frozen-lockfile`을 먼저 실행한 후
`mobile`에서 `npm install --no-package-lock`을 실행하고 다음과 같이 진행합니다.

```bash
BYEOLHARU_POC_PACKAGED_GUEST=1 npm run packaged-guest:build
BYEOLHARU_POC_PACKAGED_GUEST=1 npm run android:init
BYEOLHARU_POC_PACKAGED_GUEST=1 npm run android:sync
```

- `NEXT_PUBLIC_CLOUD_ENABLED=false`를 빌드 상수로 사용해 클라우드 연결을 끕니다.
- 기존 회원 인증, 이메일 리디렉션, 서버 API는 **해당 APK에서 검증·지원하지 않습니다**.
- APK 외부의 URL을 읽는 `server.url`을 사용하지 않습니다.
- 기존 Android 로컬 알림 엔진은 아직 이 UI에 연결되지 않았습니다.
- 앱 재설치/패키지 변경·데이터 삭제 시 테스트 기록이 유실될 수 있습니다.
- GitHub Actions에서 번들 생성 및 디버그 APK 컴파일을 먼저 검증하고,
  이후 갤럭시에서 기존 화면·저장·오프라인 실행을 실기기로 확인합니다.


## STEP 10 — 실제 비회원 습관 화면과 Android 알림 결합 (Draft)

이 단계는 STEP 9 비회원 APK의 실제 React 화면에 **네이티브 전용** 알림 설정을 추가합니다.
웹 `app/page.tsx`에서는 해당 옵션을 전달하지 않으므로 기존 웹의 알림 UI 정책은 그대로 유지됩니다.

- 계정 > 앱 설정에서 전체 습관 알림을 켜면 Android 권한을 요청합니다.
- 습관 편집에서 예정 시간 및 반복 요일과 개별 알림을 설정합니다.
- 기존 `useHabitApp`의 **저장 완료된 Snapshot**을 통해 STEP 7 수명주기 엔진을 호출합니다.
- 오늘 완료/취소, 요일·시간 변경, 습관 삭제, 앱 재진입 시 재계산을 준비합니다.
- 사용자 opt-in만 앱 전용 localStorage에 저장하고 습관 기록·클라우드 Outbox는 수정하지 않습니다.
- 회원/클라우드 모드는 이 APK에서 비활성화됩니다. 실제 로그인·백업 이전은 검증되지 않았습니다.
- 실행 시 Android 권한을 자동 요청하지 않으며 별도의 앱 ID를 유지합니다.

### 남은 실기기 게이트
STEP 9 비회원 화면/IndexedDB 재실행 보존·오프라인 검증과 STEP 10 네이티브 알림 권한,
개별 알림 편집, 완료/취소, 앱 재실행·요일 변경, 잠금화면 및 절전 상태를 점검해야 합니다.
실제 운영 회원 데이터를 사용하지 말고 데모 비회원 습관만 사용하세요.


## STEP 11 — 알림 로딩·날짜 전환 안정화 (Draft)

앱을 재시작하거나 날짜가 바뀐 직후 비회원 IndexedDB 기록이 아직 준비되지 않은 상황에서는 기존에 예약한 Android 알림을 **취소하지 않습니다**.
오늘의 최신 습관 Snapshot이 준비되면 이전과 같이 완료/반복 요일/시간을 재계산합니다.
반면 앱 설정에서 **알림 끄기**를 명시적으로 누른 경우에는 기존 관리 알림을 취소합니다.
사용자 opt-in 설정을 읽지 못하는 오류에서도 삭제 대신 오류를 알립니다.

Node 회귀 테스트는 로딩 대기, 날짜 불일치, 준비 완료, 명시적 끄기, 시계 오류를 확인합니다.
Android 실기기에서 앱 강제종료·재시작, 날짜 경계, 권한 거부와 변경 시나리오를 추가 검증해야 하며, 공식 부팅 복구/정확 알람은 아직 보장하지 않습니다.


## STEP 12 — 앱 재진입 시 기록·알림 갱신 (Draft)

Capacitor `@capacitor/app`의 Android `appStateChange` 이벤트를 설치하고,
기존 브라우저 `visibilitychange`와 중복될 때는 800ms 이내 새로고침을 한 번만 요청합니다.
실제 저장소 `useHabitApp`의 기존 `ensureDay → refresh` 흐름이 Android 전용
`byeolharu:native-resume` 이벤트를 받아 오늘 기록을 새로 읽은 후, STEP 10의
Snapshot 구독을 통해 네이티브 알림 예약을 변경합니다. 구독과 이벤트 리스너는 언마운트 시 해제합니다.

- 이미 꺼진 알림은 앱 복귀만으로 자동 활성화하지 않습니다.
- 권한 요청 팝업은 설정 화면에서 사용자 동작이 있을 때만 표시합니다.
- 오프라인 비회원 기록만 대상으로 하며 운영 웹, Supabase, 회원 정보는 변경하지 않습니다.
- **Android 앱 프로세스가 실행되지 않는 동안의 자동 부팅 복구는 아직 미구현**입니다.
- STEP 9~12 실제 갤럭시에서 앱 종료/재시작, 반복 요일, 날짜 변경, 알림 권한 변경 테스트가 필요합니다.


## STEP 12 startup-stall debug correction

If a user sees only "별하루 준비 중…" on the real guest Android APK, the
React app has not successfully mounted. The shell now reports browser runtime
errors or an initialization timeout rather than waiting indefinitely.
The GitHub Android CI also starts the real bundled `index.html`, `app.js`,
`app.css` in Chromium before compiling the APK and requires the actual
`.byeolharu` UI to mount without fatal page errors. A screenshot is uploaded
on smoke-test failure. Preserve app data; do not uninstall just to retry.

This browser check does not prove Samsung Android WebView native behavior;
inspect adb logcat/Chrome remote inspect if the APK still fails on device.


## Android edge-to-edge safe-area correction (Samsung Galaxy)

On the packaged guest APK, status bar icons were painted over the header logo,
and Android navigation buttons over the last habit card. This is a runtime
layout issue even when Gradle compiles successfully. Only the bundled Android
guest shell loads `mobile/packaged-guest/safe-area.css`, after the real web
stylesheet. It uses Capacitor 8's `SystemBars.insetsHandling = "css"` with
`--safe-area-inset-*` values and `env(safe-area-inset-*)` fallback.

The header grows by the top inset (rather than simply moving the logo), and
the scroll page keeps an extra bottom inset. Fullscreen account sheets,
regular bottom sheets and floating overlays also respect the relevant edges.
The standalone website and WebView/notification PoCs retain their styles.

The bundled browser smoke test injects example 32 px top / 24 px bottom
system insets and asserts the header, logo and bottom spacing are safe.
Device-specific nav modes (Samsung three-button and gesture navigation),
light/dark theme, modal, scrolling, keyboard, rotation and display cutout
still require Galaxy real-device verification. Install an update without
clearing application storage when verifying an existing package.


## Galaxy screenshot follow-up — native viewport + opaque sheet correction

The follow-up Samsung screenshots showed that PR #92's CSS-only inset fix was
insufficient: content still painted under both system bars, and the new-habit
editor exposed the underlying tabs below its sticky action area. The debug
packaged guest now handles the system bar and cutout insets in the native
`MainActivity`'s Android content root (real device pixels), leaving the
WebView content viewport inside the system bars. For this package alone,
`SystemBars.insetsHandling` is set to `disable` so Capacitor's CSS fallback
is not applied again. Other demo APK packages retain their old behavior.

The Android-only `safe-area.css` no longer adds the top/bottom system inset:
its header uses the normal viewport height, while the new habit editor is
anchored to the bottom of that **already safe viewport** as an opaque sheet.
The sticky form actions and underlying modal background are both opaque.

Tests: native Java template assertions verify package scoping, window insets,
and clearing only handled system-bar/cutout insets; bundled Chromium smoke
verifies the real React header and that an opened, scrolled editor reaches the
bottom of the viewport with opaque background. This is not a substitute for
Galaxy verification under gesture and three-button navigation; screenshots
should be taken during scroll and with the editor at its lowest scroll point.

Install the new APK as an update; do not delete local guest test records.


## STEP 13 — packaged guest reminder queue inspection

In the Android-only account > App Settings screen, tap **알림 예약 확인**
to see Android permission, how many guest-owned reminders are queued, how
many are still scheduled today, and the next recognized reservation time.
This is strictly read-only: it does not request a permission, change any
habit records, or create/cancel notifications. Unknown native timestamps
are identified separately rather than inventing a time. All other accounts'
reservations and unrelated notifications are excluded from the report.

The existing guest opt-in switch still controls actual scheduling. Use
this diagnostic to verify reservation state after habit edits/completions,
app restart, and explicit opt-out on the Samsung Galaxy. The report is a
snapshot from Android and does not prove the notification will arrive on
an exact minute; device battery policy can delay delivery.


## STEP 14 — expected vs actual Android guest reminder audit

In the Android-only Account > App Settings page, the new **습관 설정과 예약 비교**
control reads the current committed guest snapshot, Android pending queue and
current permission status. It uses the same 8-day scheduling planner and
reconciliation diff as the runtime, without writing to IndexedDB or invoking
native schedule/cancel/requestPermissions. It displays expected vs observed
pending totals, jobs needing addition/replacement, and stale jobs needing
cancellation. If the snapshot is still loading or yesterday's date, the audit
does not pretend to know the expected number.

Reminder diagnostic counts reflect pending Android jobs **at the moment the
button is pressed**. They cannot prove precise delivery timing, recovery
without ever opening the app, or behavior after device reboot. Use the
new audit after changing scheduled time, marking/unmarking completed, after
app relaunch and after explicitly opting out. Verify on the Galaxy after
CI and APK packaging; production website and signed-in accounts remain
unchanged.


## STEP 15 — Explicit reminder repair from Android guest settings

After tapping **습관 설정과 예약 비교**, a mismatch (status `out-of-sync`)
reveals **알림 예약 다시 맞추기**. Tapping this explicit action revalidates
opt-in, today's snapshot, Android permission and the current pending queue,
then reconciles guest-owned reminder IDs using the existing STEP 6 engine.
It will not request OS permissions, modify IndexedDB habit records, change
other account/package notifications, or auto-run on app launch. The action is
not shown for a successful audit, opt-out, denied permission or missing data.
After repair, inspect again to confirm a clean audit; native scheduling is not
transactional and can fail partially, so the UI reports errors instead of
silently claiming success. Galaxy device tests remain required.


## STEP 16 — Reboot and notification-permission recovery readiness

Capacitor Local Notifications 8.3.1 already provides
`LocalNotificationRestoreReceiver`, `BOOT_COMPLETED` and
`LOCKED_BOOT_COMPLETED` manifest handlers. We do **not** register another
receiver or try to read WebView habit storage during Android boot. The
isolated packaged-guest APK now has a CI assertion that inspects the **final
compiled APK manifest** with Android build-tools `aapt`, failing the build
if the existing plugin boot receiver or `RECEIVE_BOOT_COMPLETED` /
`POST_NOTIFICATIONS` permissions disappear during a future plugin update.

Deterministic native-adapter regression tests simulate: intact restored
notifications, missing notifications repaired on next foreground after a
current-day snapshot, notification permission denial without prompting or
writes, permission re-grant followed by foreground reconciliation, and user
opt-out remaining authoritative after reboot. All existing Android guest
reminder operations remain tied to the verified guest snapshot and explicit
opt-in; production Next.js, Supabase and signed-in accounts are untouched.

**Not claimed:** these simulated tests and APK manifest checks do not prove
alarm delivery during actual Samsung reboot, force-stop, Doze, app removal,
or OEM battery restrictions. On a Galaxy, test a future alert after a physical
reboot **without opening the app**, then open the app and compare the Android
queue. Repeat with Settings > Notifications permission disabled then enabled,
returning to the app after each change. Some devices may defer inexact
notifications. Do not delete the test app before these checks.


## STEP 17 — Notification permission versus user opt-in UI

On the Android **guest packaged** app only, Android notification permission
and the user's '습관 알림' preference are displayed separately. If the user
turned reminders ON but blocked Android permission, the switch remains ON
(the opt-in preference is preserved), while a visible notice explains that
notifications cannot currently be shown and identifies the phone settings
path to restore permission. The existing **알림 예약 확인** button now labels
Android's retained pending count as reservations **not deliverable** while
permission is denied, rather than suggesting the next reservation will be
delivered. The Android permission is checked at app launch, when app resumes,
and when a diagnostic button is tapped; none of these checks prompt for
permissions. The web entrypoint, Supabase, records, and native queue are
unchanged. Re-check the UI with Android permissions revoked and re-enabled.


## STEP 18 — Compact Android notification settings

The bundled guest Android settings now show only the reminder toggle,
permission warning/status, and one collapsed **알림 예약 및 문제 해결** row by
default. Expanding it reveals the existing read-only pending queue report,
expected/actual comparison and the mismatch-only explicit repair action.
No reminders are read or changed merely by expanding the row; the separate
buttons still make their own read-only calls and repair remains gated by
an actual audit mismatch. The 48px summary and 44px action buttons retain
keyboard/touch access. Styling is bundled only for the Android guest APK.
Operational Next.js, Supabase, guest habit records and notification scheduling
logic are unchanged. Verify the collapsed view and both dark/light themes on
an updated Galaxy APK after CI completes.


## STEP 18 follow-up — effective permission toggle and permission re-entry

Samsung Galaxy showed an ON switch even when Android OS notification
permission was denied. In the **bundled guest Android app only**, the visible
'습관 알림' switch reflects effective delivery capability: saved opt-in AND
Android permission granted. If denied, switch shows OFF, but the saved opt-in
stays intact. Tapping ON explicitly retries Android runtime permission. If
Android will not show another dialog, the native ByeolharuDeviceSettings
plugin opens this package's exact notification settings screen. On return
the app rechecks permission and reconciles using today's committed snapshot.
No automatic cancellation, deletion of existing pending jobs, preference
reset, habit record change, or Supabase/operational website change occurs.

Manual repair only appears for a detected mismatch when both the existing
user opt-in AND OS permission are granted. The native repair engine also
rechecks the latest permission and snapshot before making modifications.
Additional tests cover this difficult-to-reproduce state at the code level.
Native plugin is built only into the packaged guest debug Android APK;
other demo flavors are unmodified. Verify on Galaxy: revoke permission,
resume app to see OFF, tap ON, open system settings, grant permission,
resume app to see ON, then verify retained queue and reminder delivery.


## STEP 19 — Android release preflight and stacked PR integration map

The existing packaged-guest Android APK is an isolated debug PoC, NOT a Play
store release build. `npm run release:readiness` prints a machine-readable
read-only checklist with hard release blockers and manual approval gates.
`node scripts/check-android-release-readiness.mjs --assert-ready` exits nonzero
until the structural blockers are addressed. Neither command reads signing
secrets, alters storage, signs packages, merges PRs, or publishes anything.

### Existing stacked dependency order (all Draft as of 2026-11-20)

67 -> 74 -> 76 -> 77 -> 78 -> 81 -> 83 -> 86 -> 89 -> 90 -> 92 -> 95 -> 97
-> 99 -> 100 -> 102 -> 104 -> 106 -> STEP19.

These are sequential branch dependencies, not independent release PRs.
Review and merge bottom-up only after testing and explicit authorization.
Do not squash/merge a descendant into app/main before the base is integrated
and do not accidentally merge the PoC into the public website `main`.

### Decision log before an actual Play distribution

1. Freeze a permanent release application ID, public app name, icons and
   versionCode/versionName. The currently installed `.packagedgueststep9`
   package is not the final release ID; changing the ID creates a separate
   Android app/storage boundary and cannot in-place update the PoC.
2. Decide the release product boundary: local guest app only vs signed-in
   cloud sync. The present APK intentionally targets local guest records.
3. Commit a versioned native release Android project rather than generating
   it with `cap add android` each time. Keep release and debug package modes
   intentionally separate and preserve native system-bar/permission fixes.
4. Configure a reproducible signed release AAB build and upload key kept
   outside source control. Test through Play internal testing and verify
   the final manifest, target SDK and app signing setup.
5. Complete Play Console disclosures: privacy policy, Data Safety, store
   listing, app access, notifications/permissions and relevant declarations.
6. Validate onboarding, reminder permission, Doze/reboot/notification
   behaviors, backup/migration boundaries, and light/dark UI on devices.
7. Pass all Android/web/cloud checks, then obtain explicit approval for PR
   stack integration and release candidate preparation. Never publish from
   this diagnostic-only STEP19 branch.

### Verified facts vs remaining gates

Current 6 Android debug jobs and verify/cloud checks passed on STEP18 PR
#106. Galaxy confirmation for the new permission-toggle workflow is still
required. Existing local reminders and system-bar fixes have prior device
evidence, but no signed release AAB, final ID, or Play submission exists.


## STEP 20 — Android integration boundary gate (read-only)

CI compares **the entire latest Android stack** to `origin/app/main` by
running `node mobile/scripts/check-integration-scope.mjs --assert-scope`.
The packaged guest Android build fetches the latest `app/main` to avoid a
one-commit-only comparison. The gate accepts `mobile/` source files, the
isolated Android workflow, and seven explicitly reviewed shared code files:

- `app/globals.css`
- `components/account/account-panel.tsx`
- `components/byeolharu.tsx`
- `lib/habits/native-reminder-controls.ts`
- `lib/habits/use-habit-app.ts`
- `tests/e2e/habit-editor-balanced.spec.ts`
- `tsconfig.json`

Any unexpected web, authentication, database, production workflow, generated
Gradle output, env secret or signing key path fails the integration gate.
The seven shared files are **review-required, not automatically approved**.
Passing CI does not mean the 205 accumulated commits should immediately be
merged. Keep the entire PR stack Draft until an explicit review and merge
decision. This tool never merges branches or changes records.


## STEP 21 — Shared web/native boundary code review

Before stacked PR integration, the Android branch was compared file-by-file
to `app/main` (7 shared source/config/test paths):

- `app/globals.css`: one 44px min-width accessibility target.
- `components/account/account-panel.tsx`: optional native controls only;
  public website passes no nativeReminders prop.
- `components/byeolharu.tsx`: native habit alarm control is optional;
  web habit editor must not change alarm state when an input is cleared.
- `lib/habits/native-reminder-controls.ts`: TypeScript-only contract, no
  Capacitor imports or native service side effects.
- `lib/habits/use-habit-app.ts`: foreground resume listener is removed on
  cleanup; repeated native and browser visibility signals are coalesced.
- `tests/e2e/habit-editor-balanced.spec.ts`: tiny 0.01px CSS rounding tolerance.
- `tsconfig.json`: exclude mobile PoC from Next.js TypeScript build.

STEP 21 confines resetting `alarmEnabled` when clearing scheduled time to
the Android editor only. Normal web habit editing retains its old behavior.
New static regression checks cover public web page props, Android-only
UI guards, native-resume listener cleanup and CSS/tsconfig boundaries.
These checks are supplementary to the web E2E, Android compile and cloud CI.

The latest Galaxy notification permission OFF→ON toggle change remains a
separate device gate. No PR is merged and no release signing is enabled.
