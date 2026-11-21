# 별하루 Android — 통합 앱 개발 안내

웹과 Android는 동일한 `main` React/습관 로직을 사용합니다. Android는 **로컬 번들 기반 비회원 전용 테스트 APK**이며 아직 Play Store 출시용 앱은 아닙니다.

## 현재 지원하는 구성
- 앱 ID: `io.github.gyeongseokjeong.byeolharu.packagedgueststep9` (**기존 설치 앱의 저장소를 보존하기 위해 유지**)
- 앱 이름: `별하루 비회원 STEP 9` (정식 출시용 이름은 별도 작업)
- 웹 자산: `mobile/packaged-guest/main.tsx`에서 공통 React 컴포넌트를 패키징한 `mobile/www-packaged-guest/`
- 네이티브: 앱 설정·알림 권한·알림 예약·재부팅/재진입 처리·Android 안전 영역
- Android 회원 로그인과 Supabase 동기화는 비활성화. 운영 웹은 변경 없음
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

이 작업은 **백업 파일 내보내기 경로**를 마련한 것이며, Android 파일 공급자/저장 앱별로 실기기 검증이 필요합니다. 사용자 동의 없는 자동 클라우드 동기화 및 Android 로그인은 지원하지 않습니다.
