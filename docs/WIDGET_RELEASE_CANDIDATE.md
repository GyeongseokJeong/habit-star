# STEP 4E — Release 위젯 직접 실천 검증 후보 (#189)

기준 main: `5b7e4660` (#230). 목표는 Debug에서 확인한 위젯 완료·취소/알림·동기화를 **실제 비디버그 Release APK 환경에서 검증**하는 것이다. 일반 Release의 직접 기록 활성화, Play 서명/업로드, Android 버전, 운영 데이터/DB 및 V12.2 UI 변경은 이번 범위 밖이다.

## 빌드별 정책

| 빌드 | FLAG_DEBUGGABLE | application 후보 marker | 직접 실천(warm/cold) | 산출물 |
|---|---|---|---|---|
| Debug | true | false | ON | 기존 Debug APK |
| 일반 Release | false | false | OFF (읽기 전용) | 기존 Release 테스트 APK, 미서명 AAB, 승인된 서명 경로 |
| Release 검증 후보 | false | true | ON | PR CI 한정 별도 테스트 서명 APK |

- 후보는 `BYEOLHARU_WIDGET_RELEASE_CANDIDATE=1` + release variant에서만 생성. 기본값은 0/read-only. JS 번들, native application metadata, build-info schema 3 `widgetPractice`, 최종 artifact 검증을 동일 정책으로 연결한다. native에서 정확한 Release package와 컴파일된 boolean metadata만 신뢰하며 누락/오류는 비활성화한다. 외부 Intent, widget extras나 사용자 preference로 켤 수 없다.
- 후보 APK는 정상 Release APK/AAB 검증 및 업로드가 끝난 뒤 PR job에서만 생성한다. 별도 아티팩트 이름, 체크섬, build-info, 실제 manifest/asset 검증, 일회성 테스트 인증서 검증이 필요하다. 후보 AAB 금지. 수동 main/Play signing job은 일반 Release만 사용한다.
- 직접 실천 권한과 Debug 진단을 분리: synthetic probe/고정 실패 진단 Toast는 여전히 Debug 전용. 기존 앱/위젯 동의, 계정, claim/revision, 날짜/메모/중간 별점 보호, detached WebView 네트워크 차단, Outbox/sync, 알림 예약/복구에서 권한 분기 외 로직 변경 없음.

## 증거와 다음 인수 (실기기 미검증)

대장님은 이전 Debug 빌드에서 최근 앱 제거 후 직접 완료 및 알림 취소, 완료 취소 후 재예약 정상 동작, 온라인 회원 위젯→앱 재진입→웹 동기화 정상 동작을 보고했다. #234의 실제 local Supabase 통합 10개 및 Web 227개 테스트 통과는 자동화 증거이며, Release 후보 APK와 실제 OS offline/PID 종료/다른 계정/만료/복합 알림 시험 결과가 아니다.

1. 해당 PR Android Shell PoC의 `byeolharu-widget-release-candidate-apk-test-signed` ZIP을 내려받고 `SHA256SUMS`, build-info의 sourceSha/variant=release/widgetPractice=release-candidate 및 실제 APK 서명을 대조한다. 같은 실행의 `byeolharu-android-release-apk-test-signed`는 일반 읽기 전용 APK이므로 혼동하지 않는다.
2. **기존 앱 삭제/데이터 초기화 금지.** 후보는 실제 Release ID `app.byeolharu.android`이고 CI 일회성 인증서이므로 Play 앱·이전 실행 테스트 APK와 업데이트 서명 호환을 보장하지 않는다. 동일 ID 기존 설치가 없는 시험 기기/에뮬레이터에서 테스트 계정과 가상 습관만 사용한다.
3. 후보에서 STEP 4D D02~D06, D08을 실행. 우선 warm 완료/취소, 최근 앱 제거 후 완료/취소, 예정된 알림의 미수신/재예약 실제 수신(앱을 다시 열기 전에), 다른 습관 알림 유지. 실제 cold PID 근거와 앱 복귀 후 원본·메모·별점·동기화 확인.
4. 회원 OS offline 상태의 완료/취소와 원본 및 Outbox 보존, 연결 복구/앱 재진입→독립 브라우저/기기에서 정상 동기화, 동의·계정 경계 및 오류/복구 확인. 앱을 열지 않은 상태의 즉시 서버 동기화가 요구사항은 아니다.
5. 일반 Release는 D07(위젯 읽기 전용, 앱 내 기록 정상) 별도 확인. release-candidate와 일반 Release 모두 동일한 D01 출처 검증 필요. 실패 시 반복 실천/삭제로 복구하지 않고 원본과 증거 보존.

후보 설치 및 실제 위젯/알람/동기화 동작은 이 PR에서 NOT RUN이다. CI 통과만으로 실제 동작·OEM/절전·force-stop·기기 보존을 보장하지 않는다. P0/P1 또는 필수 미검증이 남아 있으면 정식 활성화·출시 보류. 실제 인수 검토와 소유자 승인 이후 별도 활성화 변경으로 다시 검증한다.

## 역할 관점 검토 (동일 모델 2회, 독립 전문가/실기기 검토 아님)

| 라운드 | 검토·반박 및 결정 |
|---|---|
| 1 — 제품/Android/데이터/보안/운영 | 기존 사용자 확인 뒤 바로 일반 Release를 활성화하는 안은 실제 offline·계정 경계 인수 미완료와 충돌. Debug 재검증만 반복하는 안은 비디버그 환경을 검증하지 못함. APK-only, native immutable marker, 기본 read-only, 실제 Release ID·준비된 시험 기기로 범위 한정. |
| 2 — QA/아키텍처/Android/보안/출시 | 웹/manifest/asset 불일치, stale generated project 재사용, 잘못된 candidate AAB·Play signing 유입, 같은 ID 서명 충돌을 반례로 검토. 세 가지 mode, 최종 metadata/asset bytes 검증과 CI 경로 음성 테스트, 기존 앱 삭제 금지, Debug 진단 분리로 차단. 잔여 실기기 및 Play signing/version/데이터 보존은 미승인으로 유지. |

로컬 단위/소스 계약 및 GitHub Android CI는 각각 다른 증거 층이다. PR Actions에서 제대로 컴파일된 후보 아티팩트 확인 후 실기기 시험을 시작한다.

## 후속 결과 (2026-11-28 KST)

#235 CI verify/cloud와 Android Shell PoC 성공, 후보 APK 사용자 보고 4개 항목 PASS: 최근 앱 제거 후 직접 완료, 예정 알림 취소, 완료 취소 후 알림 재예약, 오프라인 완료·취소 후 온라인 동기화. #235 main `6038a331` 병합. 실제 PID/계정·동의 경계 및 나머지 확장 인수 결과는 미확인. 소유자는 일반 Release 활성화 개발을 요청했으며 [STEP 4F](WIDGET_RELEASE_ENABLED.md)에서 기존 후보 모드를 종료하고 정상 APK/AAB에 같은 기능을 포함한다. 이 문서의 산출물·명령은 #235 시점 이력이고 현재 사용하지 않는다.
