# STEP 4F — 일반 Release 위젯 활성화 및 출시 준비

기준 main: `6038a331` (#235). 소유자의 Release 후보 실기기 4개 항목 정상 확인 및 2026-11-28 개발 진행 승인에 따라 일반 Release APK/AAB에 같은 직접 실천 기능을 포함한다. **이번 PR은 코드·테스트·미서명 AAB 및 일회성 테스트 서명 APK까지이며 Play 서명/업로드/공개 배포 승인이 아니다.**

## 1. 확정 정책 / 증거

- #235 Android Shell PoC [46033524170](https://github.com/GyeongseokJeong/habit-star/actions/runs/46033524170), CI verify/cloud [46033524329](https://github.com/GyeongseokJeong/habit-star/actions/runs/46033524329) 성공. #235 소유자 보고: 최근 앱에서 제거 후 위젯 완료, 해당 알림 취소, 완료 취소 시 재예약, 오프라인 기록→온라인 정상 동기화 4/4. OS PID 증거, exact 권한/다른 예약·날짜/재부팅·절전, 계정 전환 및 동의 철회 등의 확장 인수는 미확인.
- 비회원·회원 원본 IndexedDB 및 Outbox/Supabase RPC/RLS, scope/day/revision/version, native 동의·handle/claim/deadline, 메모·과거 기록·stale 기록 보호(1~4점의 명시적 취소는 0.1.6부터 허용), 네트워크 차단된 cold WebView, 알림 취소·재예약/실패 시 기존 foreground 보정, V12.2 UI **변경 없음**. 앱을 열기 전 cold 즉시 클라우드 동기화는 지원 계약이 아님. 사용자 기록 삭제 및 운영 환경 변경 없음.
- Debug는 실제 debuggable 여부로 기능 활성화 및 synthetic probe/고정 디버그 진단만 지원. 실제 Release ID `app.byeolharu.android`는 **비디버그** + application-level `app.byeolharu.widget.RELEASE_DIRECT_PRACTICE=true`일 때 기존 실행 경로 활성화. 누락/잘못된 타입/다른 package는 fail closed. preference/token/Intent에서 이 기능을 켤 수 없음.
- 후기 schema 4 build-info의 `widgetPractice=debug|release-enabled`, web capability, native metadata, cold JS와 실제 APK/AAB staging bytes 일치 확인. 오래된 release-candidate/read-only stamp, 기존 후보 marker 및 후보 flag, debug AAB, 변조/누락/중복 cold bundle을 거절. 후보 전용 CI 단계·환경 변수 폐기. PR에서는 표준 test-signed APK 및 미서명 AAB만 생성하며 main 수동/승인된 보호 경로에서만 서명 가능.
- Android 버전 0.1.1 / code 2는 기존 저장소 code 1 다음의 **제안 후보**이다. 실제 Play Console에서 사용한 최고 code는 repository로 확인할 수 없으므로 서명 전에 확인한다. code 2 이상이 이미 사용됐다면 별도 version 변경 필요; 추측값으로 서명하지 않는다.

## 2. 실제 출시 전 인수

| ID | 검사 | 당시 결과 |
|---|---|---|
| F01 P1 | 표준 Release APK/AAB source SHA/version/package/SDK/비디버그/metadata/필수 asset bytes/서명. CI verify/cloud/Android 완료 | 이 PR Actions 결과 필요 |
| F02 P1 | 표준 APK에서 warm/cold 완료·취소 및 실제 알림 미수신/재예약 수신(앱 재진입 전), 다른 습관 알림 보존, 앱 원본/메모/별점. | #235 후보 4개 항목 사용자 PASS; 표준 APK 실기기 NOT RUN |
| F03 P0 | 격리 테스트 계정/guest: D05/D06의 오프라인 sync/재시도, 타 계정·동의 철회/재동의, 오래된 handle/실제 인증 만료 시 원본·Outbox 보존 및 노출 차단. 기존 local Supabase 및 mock tests와 실기기 구별. | #235 오프라인→온라인 사용자 PASS; 확장 실기기 NOT RUN |
| F04 P1/P2 | 기존 Play 설치의 동일 서명 업데이트, 알림 권한·정확 알림/부팅/절전, 두 테마/크기·TalkBack, 인증 callback, 외부 백업·격리 복원(#147). | NOT RUN |
| F05 출시 | Play 최고 사용 code, 업로드 키와 Play App Signing 확인, 동일 main SHA로 내부 테스트 설치·업데이트, 스토어 정보 및 Data Safety/개인정보/권한 선언, 공개 출시 승인. | NOT RUN |

P0/P1 또는 필수 인수 미완료면 공개 출시 금지. 테스트 서명 APK와 Play 앱/다른 Actions 실행의 APK가 같은 서명이라고 가정하지 않는다. 서명 충돌 시 기존 앱을 삭제하거나 데이터를 초기화하지 말고 별도 시험 기기/에뮬레이터 사용. 문제 발생 시 반복 터치/임의 복원하지 않고 원본/백업과 마스킹된 증거를 보존. 정식 출시 후 수정 필요시 더 높은 미사용 versionCode의 새 빌드를 준비한다(구버전으로 덮어쓰거나 DB를 초기화하지 않음).

## 3. 실제 Play 출시 절차

1. PR의 Android Shell PoC 및 CI 완료 → 병합 → main의 소스/CI와 Release readiness 확인. Actions의 일반 `byeolharu-android-release-apk-test-signed` ZIP으로 F02/F03 확인. 미서명 `byeolharu-android-release-unsigned`는 Play 업로드용 서명 산출물이 아니다.
2. [Play Console](https://play.google.com/console/)의 별하루 앱 → 최신 출시 및 번들에서 모든 트랙 및 이전 업로드의 최고 사용 versionCode를 확인. 현재 후보 code 2 미사용 조건: 최고값 0(최초 업로드 확인) 또는 1. 최고값 2 이상이면 `mobile/release-version.json`을 다음 미사용 높은 code로 변경하고 다시 검증.
3. Play upload key가 기존 등록과 일치하는지 확인 후 [Android Shell PoC](https://github.com/GyeongseokJeong/habit-star/actions/workflows/android-poc.yml)를 main에서 Run workflow → `sign_internal` 체크 → 실제 `highest_play_version_code` 입력. 보호 환경 `play-internal` 승인 필요 시 승인. 이미 등록한 secret 값을 노출하지 않는다. sign job은 checksum, source/embedded build-info, version gate를 확인하고 `byeolharu-play-internal-signed` ZIP에 `byeolharu-internal.aab` 제공. GitHub Actions는 Play Console로 업로드하지 않는다.
4. Play Console → 테스트 및 출시 → 내부 테스트 → 새 출시를 만들고 signed AAB 업로드, 출시 노트 작성, 검토/내부 출시. 테스터 링크로 **Play에서 설치**하여 F04(동일 Play 서명 업데이트는 다음 code의 빌드로)와 F05 확인. [내부 테스트 피드백·최소 지표 기준안](PLAY_INTERNAL_TEST_FEEDBACK.md)을 소유자 검토 후 활용한다. 운영 계정·기존 앱의 기록을 삭제하지 않는다.
5. 신규 개인 개발자 계정(2023-11-13 이후 생성)에 적용되는 [공개 출시 전 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465): 폐쇄 테스트에서 최소 12명 테스터가 연속 14일 참여 상태 유지 후 프로덕션 액세스 신청. 내부 테스트는 이 조건을 대체하지 않는다. 실제 계정 타입/Console 상태는 소유자가 확인. 필요한 스토어 등록·개인정보·Data Safety 등 제출 사항 검토와 생산 액세스 승인 뒤 [프로덕션 출시 준비](https://support.google.com/googleplay/android-developer/answer/9859348)를 진행한다. 공개 출시는 별도 승인.

## 4. 역할 검토 (release + android + data)

동일 모델의 관점 검토 2회이며 독립 전문가/사용자 조사/단말 실행을 대체하지 않는다.

- 1회: PM/BM/마케팅/사용자(B 빠른 위젯, C 오프라인 회원)는 후보 검증 후 정식 기능을 빼면 핵심 경험이 불일치한다는 판단. 아키텍트/풀스택/Android·운영은 단순 후보 flag 기본값 반전보다 정상 빌드 정책을 하나로 만들고 구 marker/flag 경계를 검증할 것을 제안. QA/보안: 데이터 처리의 검증 범위가 넓어지는 만큼 기존 guard 및 자동화·계정 경계를 유지. 반론(실기기 복합 인수 미완료)은 타당하므로 코드와 PR 산출물까지만 승인 범위로 제한, 공개 배포 보류.
- 2회: stale generated tree, 이전 candidate AAB/read-only stamp, debuggable Release, candidate env, 서명 파일 혼동/Play 최고 버전 미확인을 반례로 검토. metadata 이름 전환·정상 mode 2개·fail-closed 검증·후보 pipeline 폐기·현재 source/embedded provenance 및 Play version guard, F01~F05 실기기 출시 인수로 수정. 비용/마케팅 범위 변경 없음, release note는 실제 검증된 기능만. 제품/사용자 목표와 데이터/보안/Android 경계를 재평가했으며 핵심 코드 경계 이견 없음; 실기기·Play 인수 N/E는 종료 조건이 아닌 공개 출시 차단으로 유지.
