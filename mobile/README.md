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

## 이후 작업
정식 appId/서명키/데이터 이관, 영구 네이티브 프로젝트, 로그인·동기화, 릴리스 AAB와 Play Console 내부 테스트를 별도 PR로 진행합니다.

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

## 실기기 피드백: 화면 잠금/앱 종료 알림 및 이메일
- Capacitor Local Notifications 8.3+의 `isExactNotification`은 schedule 내부가 아닌 최상위 옵션입니다. `allowWhileIdle: true` 및 최상위 `isExactNotification: false`로 사용자 지정 알림을 절전 중에도 실행 가능한 비정확 예약으로 요청합니다.
- 기존 예약 fingerprint에 전달 정책 버전을 반영해 업데이트 후 앱을 열면 현재 계정의 기존 예약이 새 설정으로 교체됩니다. 습관/회원 기록은 변경하지 않습니다.
- Doze 및 OS 배터리 정책에 따라 여전히 지연될 수 있고, Android 설정에서 강제 종료한 앱은 다시 실행하기 전 알림 전달을 보장하지 않습니다. 정확 시간 보장은 별도 권한/정책 검토가 필요합니다.
- 가입/비밀번호 재설정 HTTP 성공은 실제 메일 발송·수신을 보장하지 않습니다. 이미 인증된 가입 이메일이 아닌 새 테스트 주소로 가입하고, 확인된 계정으로 비밀번호 재설정을 별도 검증합니다. SMTP 환경은 변경하지 않습니다.

- 회원 예약 날짜·요일·시각은 계정에 저장된 시간대를 기준으로 계산합니다. 비회원은 단말 시간대 기준입니다. 시간대 변경, DST 전환 시 실제 예약 시각이 바뀌면 재등록합니다.
