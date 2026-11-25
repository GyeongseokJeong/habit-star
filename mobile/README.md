# 별하루 Android — 통합 앱 개발 안내

웹과 Android는 동일한 `main` React/습관 로직을 사용합니다. Android는 **로컬 번들 기반 Android 테스트 APK**이며 아직 Play Store 출시용 앱은 아닙니다.

## 현재 지원하는 구성
- 앱 ID: `io.github.gyeongseokjeong.byeolharu.packagedgueststep9` (**기존 설치 앱의 저장소를 보존하기 위해 유지**)
- 앱 이름: `별하루 비회원 STEP 9` (정식 출시용 이름은 별도 작업)
- 웹 자산: `mobile/packaged-guest/main.tsx`에서 공통 React 컴포넌트를 패키징한 `mobile/www-packaged-guest/`
- 네이티브: 앱 설정·알림 권한·알림 예약·재부팅/재진입 처리·Android 안전 영역
- Android 이메일 로그인·회원가입 및 회원 클라우드 동기화를 테스트할 수 있습니다. Android 전용 세션이며 운영 웹 설정은 변경하지 않았습니다
- 이전 원격 WebView, 기본 안내 화면, 알림 독립 실험 모드들은 지원하지 않음

## GitHub CI / APK 다운로드
GitHub Actions의 [Android Shell PoC](https://github.com/GyeongseokJeong/habit-star/actions/workflows/android-poc.yml) 워크플로를 `main`에서 **Run workflow**로 실행합니다. 일반 `main` push는 웹 CI만 실행하며 Android는 PR 검증 또는 수동 빌드로 생성됩니다.

- Android 기본 job: `android-packaged-guest-step9` 한 개
- Artifact: `byeolharu-android-packaged-guest-step9-debug`, 안에 디버그 APK와 `build-info.json` 포함
- 앱 설정 화면 하단에 버전과 빌드 SHA 표시. PR의 SHA는 검증용 임시 병합 커밋일 수 있음

## 로컬 빌드 (Node 24.22.1, pnpm 11.25.0)
```sh
pnpm install --frozen-lockfile
cd mobile
npm install --no-package-lock --no-audit --no-fund
npm run check
BYEOLHARU_POC_PACKAGED_GUEST=1 npm run packaged-guest:build
npm run packaged-guest:verify
npm run android:init
npm run android:sync
cd android && ./gradlew assembleDebug
```

이미 `mobile/android/`가 만들어져 있다면 `npm run android:init`은 생략합니다. **디버그 서명이 달라지면 덮어쓰기 업데이트가 거부될 수 있습니다. 앱 삭제·재설치 전에 반드시 기록 백업과 데이터 이관 정책을 확인하세요.**

## 정식 Android 앱 전환 기준

정식 빌드에서 사용할 앱 ID는 `app.byeolharu.android`, 런처 이름은 `별하루`로 정합니다. 현재 배포 중인 테스트 APK는 기존 ID와 서명을 사용합니다. 두 앱을 같은 기기에 설치해 이전 결과를 확인할 수 있도록 정식 앱을 별도 패키지로 빌드합니다. Play Console에서 이 ID로 등록할 수 있는지는 첫 업로드 전에 확인합니다.

- **비회원** — 기존 앱의 데이터 관리에서 JSON을 외부에 저장하고, 새 앱의 빈 비회원 공간에서 복원합니다. 이전 전후의 습관 수와 실천 기록을 대조하고 새 앱을 다시 열어 기록이 남는지 확인합니다. 복원이 거절되거나 결과가 다르면 기존 앱과 백업 파일을 보존한 채 기존 앱을 계속 사용합니다.
- **회원** — 기존 앱의 미전송 변경을 먼저 동기화한 뒤 새 앱에서 같은 계정으로 로그인합니다. 최근 오프라인에서 수정한 기록까지 확인합니다. 미전송 변경이 남아 있다면 기존 앱에서 회원 백업을 외부에 보관하고 원본을 유지합니다. 비회원 공간도 함께 사용했다면 해당 기록은 별도로 이전합니다.
- **알림과 이메일** — 새 앱에서 알림 권한과 실제 수신을 확인한 뒤 기존 앱의 알림을 끕니다. 두 앱이 설치된 상태에서 각각 요청한 가입·재설정 이메일이 요청한 앱으로 돌아오는지 확인합니다. 정식 앱의 웹 복귀 링크와 네이티브 등록은 한 변경으로 검증합니다.
- **서명과 내부 테스트** — Play App Signing을 사용하고 업로드 키는 디버그 키와 분리해 저장소 밖에서 관리합니다. 릴리스 AAB를 내부 테스트에 올려 최초 설치와 다음 버전 업데이트에서 기록·로그인·알림이 유지되는지 확인합니다.

CI의 `release-bundle` 작업은 별도 작업 디렉터리에서 정식 ID와 런처 이름으로 네이티브 프로젝트를 생성하고 `bundleRelease`를 실행합니다. 검증된 미서명 AAB는 `byeolharu-android-release-unsigned` 아티팩트로 받습니다. 내부 테스트 버전은 `mobile/release-version.json`에서 관리합니다. 첫 업로드 기본값은 1 / 0.1.0이며 기존 Play 업로드가 있으면 사용 가능한 더 높은 code로 바꿉니다. 후속 업로드마다 code를 올립니다.

GitHub 환경 `play-internal`에 업로드 키의 `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`를 등록합니다. PKCS12에서 두 비밀번호가 같으면 같은 값을 각각 등록합니다. Android Shell PoC를 main에서 수동 실행할 때 `sign_internal`을 선택하면 검증된 AAB를 서명하고 인증서를 검사한 뒤 `byeolharu-play-internal-signed`를 제공합니다. 이 파일을 Play Console 내부 테스트 트랙에 업로드합니다. 이메일 복귀에는 정식 앱 전용 `from=android-release`를 사용하므로 같은 버전의 웹 인증 경로를 먼저 배포합니다.

과거 Android STEP 1~22의 실험 기록은 [ANDROID_POC_HISTORY.md](ANDROID_POC_HISTORY.md)에 보관합니다. **그 문서의 이전 빌드 명령·실험 플래그·브랜치 안내는 현재 사용할 수 없습니다.**

## Android 비회원 기록 백업·복원
1. 앱의 **내 계정 → 데이터 관리 → 기록 백업 파일 내보내기**로 진입합니다.
2. Android 공유 선택창에서 **내 파일/드라이브 등 외부 저장 위치**를 선택하여 `byeolharu-backup-*.json`을 저장합니다. 앱 캐시에 있는 파일이나 공유창을 열었다는 사실만으로 백업이 보장되지 않습니다.
3. **내 파일** 등에서 저장된 JSON 파일이 실제로 존재하는지 확인합니다. 이 파일에는 비회원 습관과 실천 기록 등 개인 데이터가 포함되므로 공개 채팅/링크로 공유하지 않습니다.
4. 복원은 기록이 없는 새 앱에서만 **데이터 관리 → 백업 파일 복원**으로 진행합니다. Android에서는 25MB 이하 JSON/guest v2 형식 사전 검사 및 확인 창을 거친 뒤, 기존 저장소의 상세 검증·덮어쓰기 방지 정책을 실행합니다.
5. 기존 테스트 앱의 서명·패키지 ID가 달라질 때에는 앱을 삭제하지 말고 새 앱에 복원한 기록을 검증하세요. 복원 전 원본은 유지하고 자동 초기화하지 않습니다.

이 작업은 **백업 파일 내보내기 경로**를 마련한 것이며, Android 파일 공급자/저장 앱별로 실기기 검증이 필요합니다. 비회원 기록의 **자동 클라우드 이전**은 하지 않습니다. 사용자가 명시적으로 가져오기를 선택한 뒤에만 기록을 이전합니다.

## Android 이메일 로그인·회원가입 (STEP 2)
- `mobile/public-auth-config.json`은 Supabase **공개 publishable key**, 프로젝트 URL, 웹 인증용 HTTPS 도메인만 담습니다. 개인 토큰과 비밀 키는 넣지 않습니다.
- 이메일 가입/비밀번호 재설정 메일은 기존 웹의 HTTPS 인증 경로로 열립니다. 웹에서 확인 후 **앱으로 돌아와 이메일/비밀번호로 로그인**합니다.
- 회원 세션은 Android 앱 내 `byeolharu_android_auth_v1` 별도 저장소에 유지됩니다. 웹 쿠키를 복사하거나 인증 URL의 토큰을 저장하지 않습니다.
- **비회원 기록은 로그인 시 자동으로 옮기지 않습니다.** 회원 계정에서 기존 '비회원 기록 가져오기' 흐름을 통해 확인하고 직접 이전합니다.
- 실기기에서 회원가입/인증메일/로그인 유지/웹·Android 동기화/로그아웃/데이터 보존을 검증해야 합니다. CI는 실제 메일 발송이나 서버 데이터 변경을 수행하지 않습니다.
- 앱 ID 및 서명은 기존 테스트 APK를 그대로 유지합니다. 정식 Play 출시 구성은 별도 작업입니다.

## 회원 알림과 기록 백업 안전 정책
- 회원 로그인 후 Android 알림을 설정하면 예약은 `member:<UID>` 범위에만 연결하며, 비회원/이전 계정 예약은 함께 정리합니다. 로그인 중 저장소 로딩 상태에서 임의로 알림을 지우지 않습니다.
- 회원 로그인 전환 시 이미 예약된 다른 계정 알림이 남지 않도록 범위를 분리합니다. 회원 상태에서는 게스트 전용 '예약 비교/복구' 기능이 숨겨집니다.
- 회원 기록 백업은 `byeolharu-member-backup-*.json`으로 외부 파일 공유가 가능합니다. 파일 이름에 이메일/UID를 넣지 않습니다. 복원은 현재 로그인한 **동일 UID**에 한정합니다.
- 비회원 JSON은 회원 계정으로 직접 복원할 수 없습니다. 이전은 사용자 확인 후 '비회원 기록 가져오기'로만 가능합니다.
- 로그아웃 중 미전송 기록이 있으면 회원 백업 파일을 외부 위치에 저장했는지 직접 확인한 후 진행하세요. Android 공유창 자체는 보관 증명이 아닙니다.

## Android 복구 이메일과 회원 알림 조회
- Android 비밀번호 재설정 요청은 기존 `/auth/confirm?next=/auth/reset` HTTPS 링크를 사용합니다. Supabase의 implicit 복구 토큰은 서버에서 읽을 수 없는 URL fragment로 전달되며, 서버는 fragment를 노출하지 않고 동일 origin `/auth/reset`으로 이동합니다.
- 웹 재설정 페이지는 복구 토큰을 주소창에서 즉시 제거하고, 세션을 쿠키/영구 저장소에 보관하지 않는 임시 클라이언트에서만 비밀번호를 변경합니다. 완료 후 앱에서 새 비밀번호로 로그인합니다.
- 회원 알림 예약 조회는 현재 로그인 UID의 `member:<UID>` 범위만 표시합니다. 이전 게스트/다른 회원의 예약은 이 계정의 예약 수에 포함되지 않습니다.

## 사용자 선택형 정확 알람과 지연 진단
- Android 특별 접근 `SCHEDULE_EXACT_ALARM`을 사용자 명시적 설정으로 허용하면 정확한 예약을 우선 사용합니다. 권한이 없거나 확인할 수 없으면 기존 비정확 예약을 사용합니다. 제한적인 `USE_EXACT_ALARM`은 사용하지 않습니다.
- 앱 실행이나 습관 저장에서 정확 알림 설정 화면을 자동으로 열지 않습니다. **내 계정 > 앱 설정 > 정확 알림 허용** 버튼에서만 사용자가 설정 화면에 진입합니다. 복귀 시 권한을 재확인하여 기존 계정 알림 예약 방식을 동기화합니다.
- 정확 알림 권한이 회수되면 Android가 기존 정확 알람을 취소할 수 있으므로 복귀 시 재예약이 필요합니다. 앱이 실행되지 않는 동안의 자동 복구까지 보장하지는 않습니다.
- **최근 알림 지연 확인**은 이 앱에서 예약한 숫자 ID/시각과 Android NotificationManager의 실제 게시 시각을 비교합니다. 측정 대상은 현재 알림창에 남아 있는 별하루 알림뿐입니다. 사용자가 닫거나 시스템이 제거한 알림은 계측할 수 없습니다.
- 디바이스에는 알림 ID와 목표 시각만 보관하며 습관 제목·회원 식별자·알림 본문은 보관하지 않습니다. 최근 48시간 기록을 제한적으로 유지합니다.
- 정확 알람도 Doze·배터리 절약·앱 강제 중지·단말 제조사 정책 등으로 지연될 수 있습니다. Galaxy 실기기 잠금/절전/재부팅 및 권한 회수/재허용 검증 전에는 정시 보장이라고 표시하지 않습니다.

## 실기기 피드백: 화면 잠금/앱 종료 알림 및 이메일
- Capacitor Local Notifications 8.3+의 `isExactNotification`은 schedule 내부가 아닌 최상위 옵션입니다. `allowWhileIdle: true` 및 최상위 `isExactNotification: false`로 사용자 지정 알림을 절전 중에도 실행 가능한 비정확 예약으로 요청합니다.
- 기존 예약 fingerprint에 전달 정책 버전을 반영해 업데이트 후 앱을 열면 현재 계정의 기존 예약이 새 설정으로 교체됩니다. 습관/회원 기록은 변경하지 않습니다.
- Doze 및 OS 배터리 정책에 따라 여전히 지연될 수 있고, Android 설정에서 강제 종료한 앱은 다시 실행하기 전 알림 전달을 보장하지 않습니다. 정확 시간 보장은 별도 권한/정책 검토가 필요합니다.
- 가입/비밀번호 재설정 HTTP 성공은 실제 메일 발송·수신을 보장하지 않습니다. 이미 인증된 가입 이메일이 아닌 새 테스트 주소로 가입하고, 확인된 계정으로 비밀번호 재설정을 별도 검증합니다. SMTP 환경은 변경하지 않습니다.

- 회원 예약 날짜·요일·시각은 계정에 저장된 시간대를 기준으로 계산합니다. 비회원은 단말 시간대 기준입니다. 시간대 변경, DST 전환 시 실제 예약 시각이 바뀌면 재등록합니다.

## STEP 3: 이메일 확인 후 Android 앱 복귀
- 기존 HTTPS 인증 링크에 Android 요청 표시 `from=android`를 추가하며, 웹 브라우저에서 `별하루 앱으로 돌아가기`를 명시적으로 누르면 현재 테스트 앱이 열립니다.
- Android 네이티브 코드는 정확히 `byeolharu-return://auth/return`만 허용하고 앱의 로그인 화면만 엽니다. 비밀번호·이메일·토큰·회원 ID는 앱 링크에 포함하지 않습니다.
- 이미 로그인한 계정의 세션을 변경하거나 비회원 기록을 자동으로 병합하지 않습니다. 웹 로그인/비밀번호 재설정 경로는 종전대로 유지됩니다.
- 브라우저 정책상 무조건 자동 실행하는 방식이 아니라 사용자 탭이 필요합니다. 실패 시 앱 아이콘으로 직접 돌아가 사용할 수 있습니다.
- 웹 배포와 새 APK가 모두 준비되어야 이메일 실기기 종단 테스트가 가능합니다. Supabase URL allowlist에 callback 쿼리가 허용되는지 검증하세요.
- 정식 릴리스 ID로 전환할 때 웹 intent package와 native manifest를 같이 수정해야 합니다.


## Android 시스템 뒤로가기 — Navigation Policy v1.0 (2026-11-23)
- 우선순위: **열린 모달의 단계별 복귀 → 최근 7일 돌아보기에서 달력 복귀 → 아침/낮/밤/달력 탭에서 기본 '전체'로 복귀 → WebView 방문 기록 → 루트 2회 종료**. React의 기존 버튼을 네이티브 WebView에서 클릭하므로 웹/PWA 화면 로직을 변경하지 않는다.
- 계정 상세(설정/데이터 관리/사용 안내/로그인 등)에서는 시스템 뒤로가기가 먼저 '내 계정'으로 복귀한다. 계정 허브에서는 모달을 닫는다. 별빛 카드 프리뷰는 별자리 성장으로, 다른 일반 모달은 닫기로 처리한다. 모달 컨트롤이 잠시 사라져도 종료로 이어지지 않는다.
- 기본 '전체'에서 첫 뒤로가기는 **'한 번 더 누르면 앱을 종료해요'** Android 토스트를 표시한다. **2초 이내 두 번째**에는 `moveTaskToBack(true)`로 앱을 백그라운드로 보내며 프로세스를 강제 종료하거나 데이터/세션/알림 예약을 정리하지 않는다. 기한 초과, 다른 화면으로 이동, 사용자의 다른 클릭, 앱 백그라운드 전환 후에는 새로 2회를 요구한다.
- **Android 실기기 검증 (2026-11-23):** 내 계정 상세→허브→홈, 아침·낮·밤·달력→전체, 최근 7일 돌아보기→달력, 루트 첫 뒤로가기 안내, 2초 이내 두 번째 백그라운드, 2초 초과 안내 재표시 **6/6 정상**. PR #165 병합 및 CI 전체 통과. 검증 완료로 중복 확인 항목을 남기지 않는다.
- **후속 안전 개선 (PR #166 병합, UI 품질 수정 중):** 새 습관·기존 습관 편집과 오늘의 기록 작성에서 저장할 필드가 변경되었다면 Android 뒤로가기·상단 닫기(X)·취소 시 확인한다. 기존 인라인 경고가 편집 UI를 아래로 밀고 버튼 정렬을 깨뜨리는 문제가 실기기 스크린샷에서 확인되어, 화면 흐름 바깥의 실제 중앙 `<dialog>` 팝업으로 교체한다. 배경은 어둡게, 기존 편집 입력·스크롤은 보존한다. '계속 작성' 우선, '변경사항 버리기'는 명시적 동작에만 연결한다. 팝업에서 Android 뒤로가기/Escape는 **팝업만 닫아 원래 입력을 유지**한다. 데이터 저장·기존 기록·회원 동기화 및 웹/PWA 닫기 정책 불변. 라이트/다크, 320/390/430px 실기기 확인 전에는 완료 승인하지 않는다.
- 안드로이드 OS 뒤로가기 처리 중 연속 입력은 무시하여 중복 navigation을 막는다. WebView 역방향 이력이나 React 컴포넌트가 준비되지 않은 상태는 무조건 종료하지 않고 안전하게 처리한다. React 화면과 DOM 선택자의 결합은 테스트에서 검증한다.
- `mobile/scripts/check-native-template.mjs`에서 단계 우선순위/4개 비루트 탭/토스트·2초 상수/중복 방지/상태 초기화를 정적·실행 모의 검증한다. **갤럭시 실제 제스처 뒤로가기, 권한 팝업, 2초 타이밍 및 Android 예측형 뒤로가기 애니메이션은 새 APK에서 별도 확인해야 한다.**


## 회원 기존 습관의 Android 알림 예약 복구
- 유효한 예정 시간과 습관별 알림 ON 설정은 사용자의 예약 의사입니다. 재설치로 전역 플래그가 사라져도 허용된 Android 알림 권한 및 로그인한 회원의 **오늘 커밋된 기록**을 기준으로 예약합니다. 앱 첫 실행 시 OS 권한 요청은 자동으로 하지 않습니다.
- 기기 알림 설정을 허용한 다음 앱으로 돌아오면 실제 예약 목록을 자동 갱신합니다. 로딩 중 데이터를 OFF로 판단해 예약을 취소하지 않습니다. 비회원/회원 계정 범위는 유지하며 기존 48개 한도를 따릅니다.
- 런처 아이콘은 별하루 승인 이미지 원본 V2의 WebP를 Android 리소스로 직접 복사합니다. PR #153이 main에 병합되지 않은 채로 과거 Release APK를 만들었던 문제를 함께 해결합니다.


## Phase 1 — 개별 습관 알림 진입 (#188)
- 개별 알림 탭은 인증 및 오늘 데이터 준비 뒤 동일 계정의 오늘 미완료·알림 ON 습관 기록 팝업을 연다. 알림 자체는 완료/별점/메모를 저장하지 않는다.
- 과거 날짜, 다른 계정, 삭제·완료·알림 OFF·쉬는 날은 무시한다. 다른 팝업/편집/계정 화면이 열린 경우 기존 작업을 닫지 않고 탭 요청을 무시한다. 날짜/계정이 바뀌면 해당 팝업을 닫는다.
- 기존 시간대 마무리 알림 탭 이동 유지. 웹 UI·DB·예약 정책 불변.
- 실기기 확인: 백그라운드 및 프로세스 종료 후 알림 탭(회원/게스트), 날짜·계정 전환, 이미 완료/삭제, 편집 중 탭, 기록 저장/뒤로가기, 마무리 알림 탭, 라이트·다크. 강제 중지 후 알림 수신 자체는 OS 제약으로 별도 평가. CI만으로 실제 알림 전달이나 콜드 스타트 성공을 보장하지 않는다.


## Phase 1 STEP 2A/B — Compact V4 (#189)
- 2×2 Mini / 2×3 Compact, 동일 UI. 작은 ✦/현재 표시 범위/완료 수, 아이콘/제목/완료 상태, 48dp 행, 스크롤. 4×2·별자리 원화 제거.
- 위젯별 Android 구성 화면: 자동(기본, 05/11/17시)/전체/아침/낮/저녁, 완료 숨김, 시스템/라이트/다크. Android 12+ 런처 재설정 지원 여부는 실기기 확인. 미지원 런처는 삭제 후 재추가. 목록은 시간순 안정 정렬.
- 제목 노출 명시 동의 후 현재 계정의 오늘 예정 습관 표시. 로컬 no-backup 캐시에 제목/아이콘/시간대/완료 상태와 날짜 만료만 저장. UID·습관 ID·메모·토큰 제외. 계정 전환/미준비 시 삭제, 마지막 위젯 제거 시 삭제. 기존 원본 기록 및 DB 불변.
- 헤더/빈 상태 탭은 앱 실행. 체크 표시는 읽기 전용이며 앱 실행 없이 직접 기록, 항목별 상세 진입, 완료 취소는 STEP 2C 후속 PR. **이번 PR만으로 직접 체크 기능 완료가 아님.**
- 시간대/날짜 갱신은 Android 비정확 알람/30분 주기/앱 재진입에 의존. 절전 및 런처에 따라 지연 가능. 최초 위젯 추가 이후 앱을 열어 데이터를 공급해야 할 수 있음.
- 실기기: 두 크기, 스크롤/큰 글꼴, 자동 및 고정 필터, 위젯별 설정, 라이트/다크, 동의 취소·재설정, 계정 전환/삭제, 날짜·시간대, 실제 저장 후 갱신. 직접 기록은 아직 검증 대상 아님.

- 리뷰 보완: 최초 추가는 동의 필수. 기존 위젯은 재설정에서 동의를 해제하고 적용할 수 있다. 해당 위젯의 목록/완료 수를 숨기고 마지막 동의 철회 시 no-backup 표시 캐시 삭제. 다른 동의 위젯은 유지. 재동의 후 캐시가 비어 있으면 앱을 열어 갱신한다. 실기기에서 2개 위젯 중 하나 철회, 마지막 철회, 재동의 및 런처 캐시 잔존 여부를 확인한다.

- 접근성 리뷰 보완: 라이트·다크 위젯 공통 헤더 터치 높이 28→44dp, 상하 패딩 8→4dp(좌우 8dp 유지). 글자·아이콘·48dp 습관 행 유지. 목록 가용 높이는 약 8dp 감소한다. 소형 위젯에서 실제 표시 행, 큰 글꼴, 헤더 탭/스크린리더 접근성을 검증한다.

## Phase 1 STEP 2C-1 — 위젯 기록 저장 계약 (#189)
- 기존 IndexedDB scopes의 단일 readwrite 트랜잭션에서 검증과 오늘 habit_entries 수정, 회원 Outbox 추가를 함께 처리한다. 네이티브 캐시나 운영 DB를 직접 쓰지 않는다.
- 내부 명령은 현재 검증된 저장소 범위, 날짜, 습관, 로컬 revision, entry version, 이전 완료/별점 및 명시적 목표 완료 상태를 가진다. 오래된 요청/중복/다른 계정/미동기화/삭제/쉬는 날/샘플/충돌/이전 중 요청은 원본에 반영하지 않는다. 전체 revision의 보수적 비교 때문에 관련 없는 변경 이후에도 최신 화면으로 다시 시도해야 할 수 있다.
- 빠른 체크는 미완료·0점을 완료·5점으로 저장한다(사용자 승인). 완료·0/5점의 명시적 취소는 미완료·0점으로 저장하며 memo·설정·과거 기록을 보존한다. 앱 입력 5점과 위젯 입력 5점은 구분하지 않는다. 1~4점 및 비정상 미완료·별점 양수 기록은 상세 편집에서만 처리한다. 기존 기록 일괄 변경 없음. 평균 별점에는 5점이 포함되고 별자리 성장 규칙은 그대로다.
- 이번 단계는 내부 저장 계약과 단위 테스트만 추가. 아직 Android 위젯 버튼, 백그라운드 WebView/인증/수명주기/알림 연결 없음. 위젯은 계속 읽기 전용이다. 이후 실기기에서 화면 미실행·프로세스 종료·계정 전환의 안전한 저장 및 응답을 검증해야 한다.

## Phase 1 STEP 2C-2A — debug warm WebView bridge (#189)
- 디버그 APK에서만 살아 있는 기존 Capacitor WebView에 위젯 체크 요청을 전달한다. 릴리즈는 읽기 전용 유지. 빠른 체크 5점 및 0/5점 완료 취소를 허용하며 48×48dp 체크 표면 사용. 1~4점 기록은 앱 상세 편집에서 처리하며 위젯에서 해당 상세 직접 진입은 후속 단계.
- 위젯 캐시에 UUID 임시 핸들만 추가. 원본 명령·계정/습관 ID는 기존 WebView 메모리 내에만 존재. 최신 스냅샷 교체 시 핸들 무효화. 명시적 non-exported Receiver PendingIntent의 widget URI 및 표시 동의/필터/핸들을 재검증, 단일 요청 claim, 8초 제한. Android 제한으로 지연되면 완료 표시를 위조하지 않고 앱 확인 안내. 앱 완전 종료 후 실행 경로는 미구현. 자동 재시도/토큰 복제 없음.
- 기존 검증된 hook repository/epoch/session/로그아웃 guard를 재확인하고 동일 IndexedDB 트랜잭션에서 저장. 저장 후 기존 snapshot→widget/성장/알림 및 Outbox 흐름 재사용. 기존 편집/팝업 중 요청 거부. 실기기 미검증이며 프로세스 종료, WebView 타이머 중단, Doze, 스크린리더, 작은 2×2에서 제목 가용 폭, 연속 체크 및 복수 위젯 검증 필요.
- 타임아웃은 실패 확정이 아니므로 앱에서 기록 확인하도록 안내한다. 원본 커밋이 이미 끝난 경우 다음 정상 스냅샷으로 반영. cold start 지원과 release 활성화는 별도 PR/검증 이후.

## Widget V6-1 — Galaxy 실기기 테마/목록 개선 (#189)
- 증거: Galaxy One UI에서 시스템 다크 OFF 직후 글자만 라이트 색상으로 변하고 패널은 네이비 유지, 앱 재진입 후 전체 라이트로 갱신됨. 기존 parent/row 별도 테마 판단 원인 제거: renderTheme을 adapter에 전달하고 Android 12+ RemoteViews day/night 색상·아이콘·배경 tint를 동일 구성에 적용. Application.onConfigurationChanged 전체 갱신을 보조 경로로 추가. 구버전은 실행 중 구성 변경과 기존 갱신 경로에 의존. 프로세스 종료 및 One UI host reapply 동작은 실기기 재검증 전 보장하지 않음.
- 체크/미완료 표시를 22dp 전용 벡터로 교체. debug 직접 체크 48×48dp 유지, 오른쪽 정렬 및 좌우/아이콘 간격 축소. 스크롤 하단 2dp 여백 및 위젯 options 갱신. 고정 48dp 행을 유지하므로 임의 런처 높이에서 부분 행이 보일 수 있음; 실제 높이에서 전체 행을 보이게 하는 후속 검토 필요. 설정 V6-2 별도 PR. 데이터/동의/기록 정책 불변.

- P2 리뷰 보완: Android 12+ 모든 테마에서 패널 tint와 텍스트/체크 아이콘의 day/night action을 명시적으로 갱신. 고정 라이트/다크는 양쪽 host 모드에 동일 값 사용. System↔Light↔Dark 전환 시 동일 layout reapply에서 이전 색이 남지 않도록 처리. 3가지 설정 × 2가지 host 모드 선택식 및 소스 계약 테스트 추가. 실제 Samsung 런처에서 테마 전환 행렬 재검증 필요.

## Widget V6-2 — 설정 화면 (#189)
- 시스템 테마 기반 네이비/아이보리 설정 화면, 직접 선택형 필터/테마, 완료 숨김 스위치, 예시 습관 미리보기(실제 제목 접근 없음), 상태/내비게이션 바 대비, 적용 버튼. 미리보기만 위젯 테마 선택 반영. 설정 변경은 적용 전까지 draft, 회전/재생성 시 복원. 신규 표시 동의 기본 off, 기존 동의 철회 가능, 취소 시 저장하지 않음. 기존 provider 저장/검증 및 debug-only 정책 유지. 실제 Galaxy 화면/접근성/큰 글꼴/시스템 바 검증 필요.

- P2 리뷰 보완: API 24–25 라이트 모드는 흰색 내비게이션 아이콘과 대비되도록 하단 바를 네이비로 유지한다. API 26+ 라이트 모드만 밝은 하단 바와 어두운 아이콘을 사용한다. 상단 상태 표시줄·위젯 테마·저장 정책 불변. API 경계와 라이트/다크 조합 소스 회귀 검사 추가; 구형 Android 실제 화면은 미검증.

- P2 접근성 리뷰: 적용 버튼과 직접 선택 라디오, 숨김 스위치, 뒤로가기 버튼의 커스텀 배경에 키보드/D-pad 포커스(3dp 고대비 테두리) 및 누름 상태(2dp)를 추가한다. 기본 V6 색상·배치·동의/저장 정책 유지. 네이티브 체크박스 배경은 유지. 소스 계약 검사 추가, 실제 키보드·TalkBack 검증은 별도 필요.

## Widget V11-1 — 반응형 위젯 및 목록 (#189)
- 사용자 승인 V11. Mini/Compact 두 receiver 및 appWidgetId, 기본 2×2/2×3 배치, 기존 설정 저장과 consent/cache/기록 브리지 유지. 양쪽 모두 가로·세로 resize 지원, 최소 110×110dp(2×2 목표; 실제 셀은 런처 결정), 4×4 권장이나 강제 최대 제한 없음. 단일 match_parent/weight 레이아웃을 런처가 측정하므로 별도 dp→셀 추정/다중 레이아웃 불필요. 크기 변경 시 해당 인스턴스만 갱신. 다른 위젯 설정·예약·actionKey 변경 없음. 기존 위젯 선택 목록 단일화는 호환성 실기기 확인 후 별도 검토.
- 14sp 최대 두 줄, 행 wrap_content/minHeight 48dp, 헤더 44dp와 체크 아이콘 22dp/debug 48×48dp 유지. 큰 글꼴은 행이 늘어날 수 있음. 세로 스크롤과 모든 행 유지; 하단 여백 4dp 및 짧은 fading edge 적용. 부분 행은 스크롤 위치/실제 높이에 따라 남을 수 있음(정수 행 정렬 완료 주장 금지). 런처별 가시 영역, 스크롤 및 2줄/큰 글꼴 실기기 검증 필요.
- V11-2 설정 화면 및 크기별 예시 미리보기는 후속 PR. cold start 직접 기록 및 release 활성화는 범위 밖. 소스 계약 검사 추가. Galaxy에서 기존 설치 업데이트→2×2↔4×2↔2×4↔4×4 가능한 범위, 설정/동의/완료 상태 유지, 테마·오프라인·직접 기록 회귀 검증.

## Widget V11-2 — 설정 화면 리디자인 (#189)
- V11 승인 시안 적용: 기존 RadioButton/RadioGroup 선택 의미를 보존하며 기본 원형을 제거하고 Starlit Warmth Plum 채움 + 체크 문자, 8dp 행/버튼 간격, 테마 22dp 아이콘, 포커스/누름 테두리 유지. 완료 숨김 토글 선택색 Plum, 개인정보 영역 구분선과 적용 조건 안내. release 읽기 전용 및 debug warm 기록 안내 보존.
- 미리보기는 앱 위젯 options의 dp 범위 및 API31+ size 후보 중 현재 방향 근사값으로 크기 비율 계산, 누락 시 provider 기본 크기 fallback. 최대 220×200dp(좁은 화면 폭 고려)로 축소하며 동일 크기 내 설정 변경 시 높이 유지. 런처가 여러 후보만 제공할 수 있어 실제 크기와 1:1 일치 보장 아님. 실제 데이터 읽기 없이 동의 전에도 예시 표시, 필터별 샘플/완료 숨김/테마 반영. auto는 기기 시간대 기준임을 표시. 기존 신규 동의 기본 off, 기존 철회 적용 가능, 취소 무저장, 재생성 draft 유지. 미리보기는 축소된 비조작 예시이며 설정 본문은 시스템 글꼴을 따름. CI/실기기 테스트 별도.

## V11.2 — 위젯 습관 아이콘 표시 옵션 (#189)
- 사용자 승인: 위젯 ID별 `showIcons` 기본 true, 기존 설치 보존, 삭제 시 설정 제거. `습관 표시` 아래 기존 완료 숨김과 새 습관 아이콘 표시를 한 카드에 배치. native Switch·포커스·최소 48dp 유지. draft/회전 복원/적용 시 저장/취소 무저장 및 동의·철회 정책 유지.
- 동일 row layout에서 아이콘을 GONE 또는 VISIBLE로 명시 갱신, 숨기면 20dp 아이콘 폭을 제목에 반환하고 3dp 제목 여백과 기존 외곽 여백을 유지. 헤더 ✦·완료 체크·터치 영역·색상·행 순서 불변. adapter URI에 표시 모드 포함해 호스트 재사용 시 stale 설정 방지. 미리보기는 분리된 예시 아이콘/제목만 사용하며 즉시 갱신. 실제 기록·DB·인증·직접 체크 정책 불변.
- 실기기: 기존 위젯 기본 ON, OFF→ON 왕복(스크롤/크기/테마 변경 포함), 복수 위젯 독립 설정, 미리보기와 적용/취소/재진입, 동의 철회, 직접 체크 및 성장 유지. CI와 별도 검증.

## STEP 2C-2B-1 — cold runtime synthetic capability probe (#189)
- V11.2 (#212/#213), main 8447d3b: 사용자 실기기 9/10 정상, 클라우드 동기화 미확인. 통합 CI/Android Shell PoC 성공. 디자인/로컬 기록 검증 완료, release 게이트 유지.
- 기존 actionKey→command는 메모리에만 있고 cold process에서 원본 명령 복구 불가. 먼저 Debug 전용, 별도 synthetic IndexedDB marker를 정상 앱 origin `https://localhost`에서 seed하고, 유효한 기존 위젯 체크의 warm dispatch 실패 + live Activity 없음일 때 네트워크 차단한 detached WebView로 동일 marker 읽기만 실험. 실제 `byeolharu-v2`, 습관, 인증, localStorage, Outbox, 원격 DB 접근 없음. marker DB가 없으면 생성 트랜잭션 abort. origin mismatch/timeout/renderer 오류도 성공으로 처리하지 않음. 6초 한도, WebView destroy, 고정 결과 코드 Logcat 및 Toast. 기록 저장/완료 표시/자동 재시도 없음. 일반 warm 경로와 release 읽기 전용 유지. 실제 Android에서 origin/storage/renderer 실행 검증 전 cold 직접 기록 구현 완료 아님.
- 테스트: 새 Debug APK 실행 후 위젯 동의/오늘 미완료 항목 표시 확인. 홈으로 나간 뒤 ADB `adb shell am kill io.github.gyeongseokjeong.byeolharu.packagedgueststep9` (설정의 강제 중지 아님), `adb shell pidof io.github.gyeongseokjeong.byeolharu.packagedgueststep9`로 종료 확인, 위젯 체크 후 `adb logcat -d -s ByeolharuWidgetProbe:I`에서 result=readable/missing/origin/blocked/error/renderer/timeout/activity 확인. 앱 재진입 후 해당 습관/별점/메모가 변경되지 않았는지 검증. 다음 warm 체크 및 취소 회귀 확인. 실제 기기에서 marker 읽기가 확인돼도 auth·명령 복구·실제 원본 트랜잭션은 별도 과제. OS 강제 중지·절전 상태는 별도.

## STEP 2C-2B-2 — recoverable command contract (#189)
- #214 실기기 화면의 `테스트: 저장소 읽기 성공 · 기록은 저장하지 않았어요.` 및 2/3 미변경 확인. detached WebView synthetic IndexedDB 읽기 성공. ADB PID/실제 record DB/회원 인증/동기화는 별도 검증.
- Debug warm publication만 변경: 기존 validated projection의 명령을 publication마다 새 nonce로 HMAC-SHA256(128-bit opaque UUID-shaped handle) 변환. scope/day/revision/version/habitId/expected completion/rating/target 및 expiry를 고정 순서로 결합. same-origin IndexedDB에는 nonce와 expiry 한 쌍만 보관하고 이전 generation 교체/빈 projection 제거. 개인정보, 인증 토큰, 습관 데이터/명령 복제 없음. 원본 DB schema 불변. generation 저장·암호화 오류는 기존 random warm handle로 fallback. publication queue에서 superseded projection 검사 후 native publish. 기존 cache consent/claim 및 warm 원본 검증 유지.
- recovery 함수는 신뢰된 활성 계정과 그 최신 committed snapshot을 호출자가 독립 검증하여 전달해야 한다. key로 계정을 선택하지 않고 만료/다른 generation/다른 계정/변경 revision/1~4점 등은 기존 검증으로 거절. 복원 함수는 쓰지 않으며 실제 cold 경로 연결하지 않음. #214 synthetic probe 유지. native 동의/claim/deadline과 인증 확인 및 실제 원본 transaction/동기화가 다음 게이트. release 읽기 전용 유지.
- 실기기: 기존 warm 체크/취소, 재시작/위젯 갱신, cold probe 성공 및 기록 불변, 아이콘/테마 회귀. 실제 cold 저장은 후속 PR.

## STEP 2C-2B-3 — Debug cold direct practice (#189)
- #215 병합, PR CI/Android 성공. 동일 origin detached WebView에서 최초 실제 기록 연결. 기존 warm 우선, 없을 때만 native claim 및 request-bound boolean guard(소유 위젯/표시 동의/현재 handle/만료/Activity 존재 재검사), 네트워크 차단, 최대 6.5초. UI Activity 생성·종료 카운트로 경쟁 차단. 기존 synthetic probe는 역사적 테스트로 보존, cold tap은 이제 실제 저장. release는 읽기 전용, release asset에 cold JS 없음.
- 기존 localStorage Android auth session과 이전 verified marker 일치 + 확인 이메일 + 유효기간 남은 세션인 경우에만 회원 local scope를 열며, 두 값 모두 없을 때만 guest. 불일치/만료/오류는 기록 안 함; 서버 인증을 새로 수행하거나 토큰을 복제하지 않음. 기존 DB만 열고 초기화/ensureDay/마이그레이션 없이 validated generation/committed snapshot에서 명령 복원 후 기존 applyWidgetPractice/Outbox 사용. 저장 전 동기 guard 및 revision/version, 메모/1~4점 보호. 성공한 트랜잭션 후 최신 snapshot으로 새 projection과 generation 생성, 실패 시 원본 보존 및 앱 확인 안내. 결과 유실 시 저장 여부를 단정하지 않음.
- 클라우드 전송 및 알림 재조정은 기존 앱 실행/동기화 경로에서 처리. 즉시 서버 동기화·완료 습관 알림 취소·OS force-stop·절전·foreground race는 아직 실기기 검증하지 않음. 실제 기기 cold 체크/취소, 멤버/게스트·오프라인·만료·자정·동의 철회·앱 재진입·다른 위젯/별점/성장/메모 및 Outbox 검증 전 release 활성화 금지.

## STEP 2C-3 — 위젯 습관 상세 진입 Debug (#189)
- #216/#217 병합, #217 CI/Android 성공, 사용자 cold 통합 확인상 이상 없음(항목별/ADB PID/회원 클라우드·알림 재조정은 미확인). 상세 진입은 Debug만; 기존 체크 경로/레이아웃/별점/DB 및 release 읽기 전용 유지.
- 습관 제목·이모지 탭은 상세 기록 열기. 1~4점 등 quick action이 없는 체크 영역도 상세 진입(기록 변경 없음). 체크 가능 항목은 기존 완료/취소만. 현재 표시된 widget/detailKey 및 동의·기한을 native receiver에서 검증 후 사용자 탭에 한해 앱 실행. 한 번 소비하는 30초 요청, 계정/습관 ID는 native에 전달하지 않음. Android launcher BAL 호환성은 실기기 검증 필요.
- 동일 origin generation DB에 navigation 전용 무작위 secret만 추가 저장. HMAC(scope/day/habit)로 오늘 예정된 실제 습관의 detailKey 생성; revision-bound practice key와 domain 분리, 완료·별점/일상 갱신 후에도 같은 날 같은 습관은 안정적. 이전 키로 다른 계정/날짜/삭제 습관 접근 금지. 앱의 정상 인증·hydration 후 snapshot에서 해석, 기존 알림 상세 흐름을 재사용하되 위젯은 완료/알람 없는 항목도 허용. 기존 편집/팝업을 덮지 않음, 상세 화면 계정/날짜 경계 유지. cold 직접 저장 후에도 detailKey 재발행. 신규 권한/원본 저장 변경 없음. CI 및 실제 launcher warm/cold, 여러 위젯·아이콘 숨김·1~4점·저장/취소·알림 회귀 확인 필요.

## V12.0 — 빠른 실천 + 홈 버튼 (#189)
사용자 실기기 #218 상세 진입 UX 불편으로 철회. [V12 명세](../docs/WIDGET_V12_SPEC.md) 참조. 기존 알림 상세 및 warm/cold 기록 유지, 행 전체 동일 키, 보호 행 안내만, 홈만 앱 실행. stale detail 무시, adapter /v12/, 다음 generation 저장에서 obsolete secret 제거. 48dp 헤더, 44×48dp 홈, 22dp 골드, 우측 8dp, host min height 기준 1~2행 60dp/기타 48dp. synthetic preview 반영, 기존 위젯 크기/설정/스크롤/release 읽기 전용 유지. CI/실기기 검증 필요.

### V12.1 설정 시인성 개선
V12.0 실기기 10/10 정상. 두 토글의 native Switch 유지, 불투명 checked/unchecked track selector 적용. 오래된 Debug 안내 제거, release 읽기 전용 안내 및 개인정보 동의 유지. 위젯 본체와 기록 로직 변경 없음. [명세](../docs/WIDGET_V12_SPEC.md).

### V12.2 토글 비율
사용자 피드백 ON 왼쪽 빈 공간 축소. 40×24dp 트랙, 18dp centered 원형 thumb, 양 끝 2dp 목표, 색상·48dp 행·기존 checked/draft/apply 유지. OEM 기본 thumb 의존 제거. CI 및 기기 검증 필요.
