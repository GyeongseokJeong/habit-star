# 별하루 Android — 통합 앱 개발 안내

웹과 Android는 동일한 `main` React/습관 로직을 사용합니다. Android는 **로컬 번들 기반 Android 테스트 APK**이며 아직 Play Store 출시용 앱은 아닙니다.

## 현재 지원하는 구성
- 앱 ID: `io.github.gyeongseokjeong.byeolharu.packagedgueststep9` (**기존 설치 앱의 저장소를 보존하기 위해 유지**)
- 앱 이름: `별하루 비회원 STEP 9` (정식 출시용 이름은 별도 작업)
- 웹 자산: `mobile/packaged-guest/main.tsx`에서 공통 React 컴포넌트를 패키징한 `mobile/www-packaged-guest/`
- 네이티브: 앱 설정·알림 권한·알림 예약·재부팅/재진입 처리·Android 안전 영역
- Android 이메일 로그인·회원가입과 기존 회원 데이터 동기화를 지원합니다. Android 전용 세션이며 운영 웹은 변경 없음
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

## Android 이메일 로그인·회원가입 (STEP 2)
- `mobile/public-auth-config.json`은 Supabase **공개 publishable key**, 프로젝트 URL, 웹 인증용 HTTPS 도메인만 담습니다. 개인 토큰과 비밀 키는 넣지 않습니다.
- 이메일 가입/비밀번호 재설정 메일은 기존 웹의 HTTPS 인증 경로로 열립니다. 웹에서 확인 후 **앱으로 돌아와 이메일/비밀번호로 로그인**합니다.
- 회원 세션은 Android 앱 내 `byeolharu_android_auth_v1` 별도 저장소에 유지됩니다. 웹 쿠키를 복사하거나 인증 URL의 토큰을 저장하지 않습니다.
- **비회원 기록은 로그인 시 자동으로 옮기지 않습니다.** 회원 계정에서 기존 '비회원 기록 가져오기' 흐름을 통해 확인하고 직접 이전합니다.
- 실기기에서 회원가입/인증메일/로그인 유지/웹·Android 동기화/로그아웃/데이터 보존을 검증해야 합니다. CI는 실제 메일 발송이나 서버 데이터 변경을 수행하지 않습니다.
- 앱 ID 및 서명은 기존 테스트 APK를 그대로 유지합니다. 정식 Play 출시 구성은 별도 작업입니다.
