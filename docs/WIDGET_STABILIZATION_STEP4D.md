# STEP 4D — 위젯 종합 인수 및 출시 차단 기준

최초 기준 main `a967e075` (#229), 최신 통합 기준 main `4aa7fb9` (#234), #189 / STEP 4A~4C, V12.2 디자인 동결. 목적은 **검증 가능한 Debug APK와 Release 읽기 전용 패키지의 인수**이며, Release 직접 기록 활성화/Play 서명·업로드/버전 변경은 범위 밖이다.

## 증거와 판단

| 증거 | 결과/범위 |
|---|---|
| 기존 V11/12 실기기 사용자 보고 | V11 13/13, V11.2 9/10(클라우드 미확인), V12.0 10/10, V12.2 5/5. 해당 당시 빌드/항목의 증거만 유지. |
| #228 STEP 4B-2 | 기존 단위·Android CI, JVM 및 upstream API 계약/실제 컴파일. OS 예약 전달과 비원자적 storage/AlarmManager 실패는 미검증. |
| #229 STEP 4C | CI verify/cloud 최종 성공, 225/251/3 및 cloud 10개(실제 local Auth/RPC/RLS, 가상 IndexedDB, 독립 브라우저). Android 프로세스·OS offline·실제 토큰 자연 만료는 미검증. |
| #230 최초 head `0f5a3c1` | CI [#1338](https://github.com/GyeongseokJeong/habit-star/actions/runs/45959982626), Android [#366](https://github.com/GyeongseokJeong/habit-star/actions/runs/45959982629) 성공. 최신 main 병합 후에는 새 head로 다시 확인. |
| #234 main `4aa7fb9`과 동일 tree | CI [#1346](https://github.com/GyeongseokJeong/habit-star/actions/runs/46028167720) verify/cloud 성공. 실제 로컬 Supabase DB 테스트 및 브라우저 통합 10/10, 9·10번 cold 완료·취소 동기화/응답 유실/실제 인증·RLS 테스트 성공. Android [#371](https://github.com/GyeongseokJeong/habit-star/actions/runs/46028167780) 성공. 227 웹 단위·175 Android 검사 및 반복 완료/취소 12회(실제 planner, native poll 식, 가상 예약 목록) 통과. |
| 2026-11-28 #234 사용자 보고 | 최근 앱에서 제거 후 위젯 완료 및 알림 취소 정상(D04-a 사용자 보고 PASS). 완료 취소/재예약도 동작하는 것으로 관찰, 코드 검증 PASS. PID·예약/발신 package·정확 수신 시각/별도 H3 등은 미확인. 전체 D03/D04 인수로 확대하지 않음. |
| 이 PR | 최신 main 통합, 패키지 검사 보강 및 인수 증거 갱신. CI 대상 실행·artifact SHA로 판정. 로컬 실제 기기/SDK/Docker 부재, 미검증 인수 하위 항목은 NOT RUN 유지. |

하네스 `qa + android + data` 및 release-guardian: 독립 QA/Android, architecture/security/data, PM/UX/사용자 관점과 구현/운영 검토. 1차: 기존 CI로 실기기 승인 대체 금지, 실제 manifest FLAG_DEBUGGABLE + asset bytes 확인, Debug checksum 및 signed Release APK 동일 manifest 경계 검증 제안. 대안(활성화 먼저, 데이터 삭제 후 초기 설치, 운영 API 자동 쓰기)은 기각. 2차: 최종 APK/AAB variant 음성 검사와 APK 위젯 컴포넌트·서비스의 최소 노출, 별도 테스트 서명과 계정/알림/원본 검증 조건으로 재평가. 제품 UI 변경 없음. 자동화 증거와 실제 기기·사용자 조사(N/E)를 분리한다. 실제 출시 판정은 필수 인수 이후 별도 승인.

## 1. 아티팩트 선택 (CI evidence)

- Android Shell PoC의 같은 실행에서 Debug APK, 테스트 서명 Release APK, 미서명 AAB를 받는다. PR Actions 기본 checkout은 **임시 병합 SHA**일 수 있으므로 head SHA와 같은 값으로 추정하지 않는다. `build-info.json.sourceSha`, 해당 실행 `GITHUB_SHA`, 앱 설정의 SHA/버전 및 APK SHA256SUMS를 대조한다. Android version은 `mobile/release-version.json`의 0.1.0 / code 1 (이번 PR은 변경하지 않음).
- Debug: `byeolharu-android-packaged-guest-step9-debug` (ID `io.github.gyeongseokjeong.byeolharu.packagedgueststep9`). 앱 데이터 있는 기존 APK의 서명과 맞지 않으면 설치 중단. 설치 성공을 위해 기존 앱을 삭제하거나 데이터 초기화하지 않는다.
- Release: `byeolharu-android-release-apk-test-signed` (ID `app.byeolharu.android`). 이 실행의 일회성 테스트 인증서로 서명한 **테스트 전용** APK. Play 서명 설치본/이전 테스트 서명과 호환을 보장하지 않는다. 동일 ID의 기존 설치가 없는 별도 시험 기기/에뮬레이터에서 실행. Android 사용자/프로필만 바꿔 서명 충돌을 해결할 수 있다고 가정하지 않는다. `byeolharu-android-release-unsigned`는 검증된 미서명 AAB이지 설치 APK나 Play 업로드/서명 승인이 아니다.
- APK와 AAB의 실제 variant/패키지/SDK/version/sourceSha, 실제 debuggable(Debug true, Release false), cold runtime asset(Debug만), app.js/CSS/HTML/build-info 및 Debug cold JS 바이트가 같은 job staging과 일치하는지 검사한다. APK 양쪽 실제 위젯 receiver 2개/설정 Activity/list Service의 노출과 권한, 동일 process/부팅 알림 계약을 검사하고 서명 검증도 실행한다. Build-info와 체크섬은 재현용이며 전체 toolchain 바이트 재현성/공급망 인증은 아니다.
- 4B-2의 native guard는 `ApplicationInfo.FLAG_DEBUGGABLE`; 실제 Android의 컴파일된 debug 플래그를 본다. AAPT [공식 소스](https://android.googlesource.com/platform/frameworks/base/+/master/tools/aapt/Command.cpp) 및 고정 bundletool [XPathResolver 1.18.3](https://github.com/google/bundletool/blob/1.18.3/src/main/java/com/android/tools/build/bundletool/xml/XPathResolver.java) 기준. Release에 native class/probe 자체가 없는 것으로 단정하지 않는다. 최종 flag/asset/source contract 통과는 설치본 UI 동작 또는 OS 예약 성공의 증거가 아니다.

## 2. 소유자 실기기 인수표 — 우선 8개

준비: 별도 시험 기기 또는 안전한 기존 Debug 설치, 백업 확인, 실사용자/실기록 대신 격리된 테스트 계정·가상 습관 H1/H2/H3. 예: H1 '테스트 독서' (미완료+테스트 메모), H2 '테스트 산책' (별점 3), H3 '테스트 알림' (별도 미래 시간). 회원 테스트는 승인된 테스트 계정/환경에서만 진행하고 비밀번호·토큰·이메일·실제 기록을 결과에 첨부하지 않는다. 기존 앱/기록 삭제 금지. 실패 또는 데이터 불일치 발견 시 반복 터치/임의 복구를 멈추고 원본/백업 보존.

| ID / 심각도 | 시험 | 기대 및 통과 조건 | 결과 |
|---|---|---|---|
| D01 P1 | 두 APK의 build-info·SHA256·버전·패키지·서명 확인 및 정상 설치/실행 | 검증 대상 정확히 일치, 기존 데이터 유지. 서명 불일치는 BLOCKED | NOT RUN |
| D02 P1 | Debug guest warm. H1 완료→앱 5점/별자리 성장, 취소→0점. H2 3점 보호, 연속 터치/두 위젯에서 동일 상태 | 실제 저장 후 UI·오늘 기록 일치, 메모 보존, 1~4점 기록 강제 덮어쓰기 없음, 동일 오래된 명령 재실행 없음 | NOT RUN |
| D03 P1 | Debug guest cold: 홈→프로세스 실제 종료 후 H1 완료. 앱 복귀해 확인, 신선한 handle로 다시 cold 취소 | 완료/취소 각각 직전 PID 부재와 터치 중 Activity 미실행, 후속 앱 확인 5→0점, 날짜/메모/다른 습관 보존. PID 근거 없이 cold라 판정하지 않음 | NOT RUN |
| D04 P1 | 예약이 충분히 미래(5~10분)인 H1 cold 완료. 앱 재진입 전 해당 예약/실제 미수신, H3 예정 알림 수신. 새 H4에 미래 알림 설정 후 앱에서 완료(예약 없음)→PID 종료→cold 취소, 앱 열지 않고 예정 수신 | 오늘 해당 ID만 취소/복구, 정상 1회 수신 및 별도 H3/마무리/미래 유지; PID/예약/실제 수신 시각 근거. 앱 재진입 전 검증 | 부분 확인: D04-a 사용자 보고 PASS; 취소 재예약 사용자 관찰 및 코드 PASS; 나머지 NOT RUN |
| D05 P0 | 동일 테스트 회원 A로 기기 1/2 로그인. 초기 동기화→기기 1 OS offline + PID 종료→cold 완료→오프라인 앱 재열기→ON/sync→기기 2 확인. 취소도 반복 | 원본+대기/5점→0점·메모 보존, 기기 2는 sync 전 이전 상태·sync 후 일치. 앱을 열기 전 즉시 서버 sync를 기대하지 않음 | 실제 로컬 Supabase 통합 PASS; 온라인 회원→앱→웹 동기화 사용자 보고 PASS; OS offline/PID/두 기기 실기기 NOT RUN |
| D06 P0 | 위젯 표시 동의 철회/재동의·마지막 위젯 제거, 인증 만료/다른 계정/로그아웃 확인 취소. 테스트 계정만 사용 | 다른 계정/guest 기록 변경·제목/메모/토큰 노출 없음; 미전송 A는 백업·동의 없는 삭제 금지; 정상 재인증 후 기존 처리 | 실제 로컬 Supabase auth/RLS/재시도 PASS, 실기기 복합 인수 NOT RUN |
| D07 P1 | 별도 기기의 test-signed Release. 위젯 표시/설정/행·체크 터치 및 홈버튼; 앱에서 직접 완료·취소, 알림 및 정상 sync | 위젯에서 직접 기록·상태 조작 불가, 홈은 정상 앱 실행, 앱 내 기록/알림/회원 sync 정상 | NOT RUN |
| D08 P2 | 2×2, 2×3 및 resize, 긴 제목/스크롤/완료 숨김, 양 테마와 설정, 큰 글자/TalkBack, 알림 진입 | V12.2 디자인 유지, 체크 접근성·안전 영역, 잘림/대비/동의 회귀 없음. 기존 UI 결과는 참고 | NOT RUN |

결과 기록: ID / PASS·FAIL·NOT RUN·BLOCKED / 실제 결과 / 기기(OS, 런처, Android System WebView, 시간대, 알림·exact 권한) / variant·source SHA·artifact SHA256 / 발생 시각·재현 단계·마스킹된 이미지. 복합 항목은 하위 조건마다 기록하고 일부만 수행했다면 상위 PASS 금지. 테스트 보고자가 제공한 증거임을 기록; mock·CI와 혼동하지 않는다.

## 3. 기술 인수 부록 (D02~D07 확장, 위 증거 외 실기기 NOT RUN)

- 실제 cold 구분: 시험 Debug 패키지를 홈으로 보낸 뒤 ADB `adb shell am kill io.github.gyeongseokjeong.byeolharu.packagedgueststep9` + `adb shell pidof io.github.gyeongseokjeong.byeolharu.packagedgueststep9`로 PID 부재 확인. 실패하면 실제 종료로 판정하지 않는다. 런처 최근앱 닫기만으로 cold 증거 아님. 강제 중지(am force-stop) 및 Activity만 종료/PID 생존은 별도 시나리오. 일반 앱 재진입 전 기록 성공/알림 증거 수집; cold 상태에서 Activity가 생기지 않음 확인.
- 4B B01~B08: package-filtered AlarmManager 상태와 실제 수신 시각을 함께 기록. PendingIntent token 존재·부재만으로 OS 예약/수신/미수신을 단정하지 않는다. 시간대/자정/DST/시계 역행/near-due·권한 철회·48 cap/충돌, 예약 작업 중 프로세스 사망·storage 부분 실패·orphan·boot·Doze·OEM 절전·force-stop. 정상 보류/중립 안내와 실패 구분, 원본 기록 성공을 rollback하거나 위젯 자동 재시도하지 않는다. 전환/다른 ID/시간 이후 알림 건드리지 않음. 실제 계정/기기에서 시계 변경·강제 종료 실험은 하지 않고 격리 시험 기기에 한정.
- 4C C01~C03 및 경쟁: 진짜 JWT 만료/검증 키 누락/타 계정/오프라인 재개/응답 유실/별점 충돌. 실제 서버 정상 계정 인증/재로그인과 peer 확인이 필요한 항목을 자동화 결과로 대체하지 않는다. 계정 전환은 미전송 동기화 또는 검증된 백업과 명시 동의 이후에만; 취소 선택 시 유지. 타 계정/guest 조회와 서버 일치 검증, 개인 토큰/로그 전체를 수집하지 않는다.
- Release 읽기 전용: 실제 D07이 통과한 뒤에도 Play 서명 AAB, 동일 서명 업데이트/보존, Play App Signing/미사용 높은 versionCode, 스토어 선언/외부 복구(#147)는 별개 게이트. 직접 기록 활성화가 승인되면 그 변경의 Release 패키지로 다시 인수. 강제 중지·Doze·OS 미동작을 성공으로 보장하지 않는다.

## 4. 판정 및 차단

- **P0:** 원본/Outbox 유실, 다른 계정/위젯 기록 누출, 중복/잘못된 날짜·별점·기록 변경. P1: cold 저장 또는 알림 취소·복구 불일치, 실제 Release 직접 쓰기, 잘못된 variant/서명/출처, 필수 검증 불명. P2 접근성/디자인 회귀도 사용자 영향에 따라 재평가(핵심 실천/접근이 불가능하면 P1).
- P0/P1 또는 필수 자동화/실기기 미해결이면 인수·활성화·출시 보류. 부분 실패에서 정확한 실패 상태와 원본/다른 예약 보호, foreground 복구가 실기기로 입증돼야 한다. 기존 4B 비원자적 예약/스토리지 경계의 잔여 위험은 지속 추적.
- 현재 **자동화 최종 확인은 최신 통합 head의 CI 기준**. #234에서 사용자 보고한 재현 경로는 정상화됐으나 D04 전체 및 D05/D06 등 필수 미검증 실기기 하위 항목이 남음. 실기기 인수 결과와 PM/QA/Android/security 재검토 및 대장님 승인 전 Release 직접 기록 비활성, #189 open. 운영 DB/계정/서명키/Play 배포 변경 없음.

## 5. 다음 우선 검증 — 실제 회원 기록 왕복 (D05)

별도 테스트 계정의 가상 습관으로만 실행. 기존 Debug 앱/기록을 삭제하거나 테스트 서명 Release로 덮어쓰지 않는다. 기기 2 대신 독립 브라우저 로그인으로 서버 왕복을 우선 확인할 수 있으나 두 기기·PID·OS offline 하위 항목을 자동 PASS 처리하지 않는다.

1. Debug 앱과 다른 기기(또는 브라우저)에 동일 테스트 계정 로그인. 가상 습관 H1을 미완료로 만들고 테스트 메모를 저장, 두 화면에 0점/메모가 보이는지 확인.
2. 기기 1을 오프라인으로 전환하고 최근 앱 목록에서 제거(실제 PID 종료는 ADB로 별도 확인). 위젯에서 H1 완료, 기기 2/브라우저는 아직 미완료. 앱을 오프라인으로 열어 5점 및 메모/동기화 대기 상태 확인.
3. 인터넷 ON 후 정상 앱의 동기화 완료를 기다려, 기기 2/브라우저 새로 고침(정상 pull)에서 5점과 같은 메모 확인.
4. 새 위젯 상태로 H1을 동일한 조건에서 완료 취소, 앱 복귀 후 0점과 메모 및 기기 2/브라우저의 정상 동기화 확인. 중복/다른 습관·계정 영향 없이 동작해야 한다.
5. 결과는 완료/취소 각각 로컬·서버/독립 화면·메모·오프라인 여부·오류만 보고. 토큰·이메일·실기록 노출 금지. 네트워크가 끊긴 상태의 위젯 저장과 정상 앱 복귀 이후 동기화가 계약이며, cold 위젯은 네트워크를 직접 사용하지 않는다.

### 최신 통합 검토 (동일 모델 역할 관점 2회)

| 라운드 | 반박·결정 및 검증 |
|---|---|
| 1 / QA·Android·풀스택·보안 | #234 실제 로컬 DB/RPC 및 독립 브라우저 성공으로 C01~03 자동화 근거 확보. 그러나 cold renderer의 OS 프로세스/실제 회원 기기 상태는 가상 IDB와 구분. D04-a 사용자 보고 및 재예약 코드 검증을 기록하되 D04 전체·D05 실기기 PASS로 확대하지 않는다. |
| 2 / 제품·사용자·아키텍트·운영·QA·Android·보안 | 사용성상 Release 직접 완료를 원하는 것은 타당하나 #230은 최신 main 이후의 manifest/asset/checksum 인수에 필요. 기존 4D 검증 코드와 #231~234 런타임을 함께 통합, 공개/비공개 저장 정책·계정·알림·릴리스 guard 불변. 테스트 계정으로 D05 확인 후 나머지 필수 조건을 검토하고 별도 Release 활성화 PR을 결정. 실제 운영 데이터 검사, 배포 또는 출시 승인을 대체하지 않음. |

실제 독립 에이전트/전문가·기기 실행 아님. 코드·증거 범위에 이견 없음. 필수 미검증은 출시 보류(N/E).

### 후속 STEP 4E — Release 검증 후보

온라인 회원 위젯→앱 재진입→웹 동기화는 사용자 보고상 정상. 오프라인/실제 PID 및 D05/D06 복합 인수는 아직 미완료. 비디버그 Release 환경에서 직접 완료를 시험하기 위해 [별도 APK 후보](WIDGET_RELEASE_CANDIDATE.md)를 준비한다. 기존 일반 Release의 read-only D07과 Play 경로는 그대로 유지하며, 후보 자체를 정식 활성화 승인으로 취급하지 않는다.

### 후속 STEP 4F — 일반 Release 활성화

#235 후보의 소유자 확인 네 항목(PASS)은 [STEP 4E 후속 결과](WIDGET_RELEASE_CANDIDATE.md)에 기록했다. 이 표의 read-only D07은 당시 #230~235 일반 Release 기준 이력이다. 활성화 이후의 실제 Release 인수는 [STEP 4F](WIDGET_RELEASE_ENABLED.md)의 F01~F05로 대체한다. D04/D05/D06/D08의 추가 미확인 하위 항목 및 Play 서명/업데이트 인수는 유지하며 공개 출시는 별도 승인한다.
