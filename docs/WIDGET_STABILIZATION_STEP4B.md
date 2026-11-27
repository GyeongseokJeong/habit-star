# STEP 4B-1 — 종료 상태 위젯 알림의 안전한 결정 계약

기준 main 1ac1e637 / #189, STEP 4A, V12.2 디자인 동결. 이번 PR은 **결정 로직과 실제 컴파일된 네이티브 의존성 API 검증**이다. 실제 cold 알림 변경은 4B-2, 회원 클라우드 검증은 4C, 종합 실기기 인수는 4D로 분리한다. 기존 앱 복귀 시 재조정 및 Release 직접 기록 비활성은 유지한다.

## 근거 및 대안
- `widget-cold-practice.ts`는 독립 WebView의 검증된 기존 원본에서 단일 명령을 저장한다. `ByeolharuWidgetColdPractice`는 네트워크 없는 WebView와 요청 한정 allowed()만 가지며 Activity의 Capacitor bridge가 없다. JS LocalNotifications를 import해도 실제 Android plugin에 연결되지 않는다.
- 고정 `@capacitor/local-notifications 8.3.1` [공식 소스](https://github.com/ionic-team/capacitor-local-notifications/tree/0fbde4878e97e9947d5413737252012befbab139/android/src/main/kotlin/com/capacitorjs/plugins/localnotifications)에서 Kotlin manager/NotificationStorage/Plugin 확인; app bridge에 필요한 PluginCall은 [8.6.2](https://github.com/ionic-team/capacitor/tree/8.6.2/android/capacitor/src/main/java/com/getcapacitor). manager는 null Activity 및 schedule의 null call을 허용하지만 plugin의 저장소 append와 cancel의 PluginCall resolve까지 동일하게 재사용해야 한다. getPending/저장소/시간 기반 scheduled 분류는 실제 AlarmManager 예약·전달 확증이 아니다. schedule은 시간이 지나면 즉시 게시할 수 있으며 OS 작업과 SharedPreferences apply 사이 프로세스 종료 가능성도 있다.
- 전체 native bridge/Activity 강제 실행, AlarmManager 직접 cancel, private storage 키 쓰기, 전체 lifecycle.sync 복제, 범용 schedule/cancel API를 cold WebView에 노출하는 대안은 기각(권한/소유권/복구/경쟁 위험). 실제 연결을 추측으로 구현하지 않는다.

## 하네스 (android-native + data + implementation)
Android/QA, 아키텍트/보안/data, PM/UX/사용자 독립 서브에이전트 + 구현/클린코드 관점. 1차: 실제 데이터 쓰기/권한·다중 계정 경계를 유지하며 단일 예약만, UI와 기록 성공 유지. 기술 반박: getPending만으로 ID 사용 가능성 판단 불가, 기존 전체 diff는 다른 예약을 취소하고, 실제 연결은 기존 API와 저장소·타이머가 비원자적. 결정: 순수 계약부터, 실제 쓰기는 후속 기술 게이트. 2차: QA/API 소스 대조 통과, 보안의 별점·실제 단발 payload/시각·정확 JVM descriptor 대조 제안을 수용하여 테스트와 감사 기준에 반영. PM/UX의 권한 철회·부분 실패 안내 수용 기준을 보강. 신규 핵심 이견 없음(실제 연결은 여전히 보류). 실기기·실제 사용자 관찰 N/E.

## 결정 계약
- 기존 commit 성공 **이후** 동일 scope/day/account timezone, 정확한 revision +1 및 entry version/목표 완료·별점 상태가 확인될 때만 결정. member hydrate 및 오늘 history 확인. 다른 습관, 미래, 마무리 예약은 수정하지 않는다.
- 기기 opt-in 명시 OFF 우선, null은 기존 habit intent, corrupt prefs 또는 OS 권한/정확 알림 상태 미확인 시 보류. 권한은 요청하지 않는다.
- 기존 scoped planner/fingerprint/ID/channel/exact 정책 그대로 사용. 저장된 ID key와 파싱된 전체 목록·예정 분류·현재 표시 ID 및 실제 payload(단발 시각, exact 플래그, idle/channel, 제목·본문)를 대조. 4B-2에서는 native key별 decoded ID도 일치 검증. 충돌/중복/잘못된 fingerprint/다른 종류·일자·계정/이미 표시·저장만 남은 ID는 보류. 타인의 예약을 취소하지 않는다.
- 완료: 아직 미래 시각의 정확한 소유 대상 1건만 취소 결정. 취소: 오늘 예정 시각이 충분히 미래이고 기존 48개 우선순위 계획에 포함되며 추가 여유가 있는 경우에만 동일 payload 복구 결정. 2초 보수적 여유는 운영 보장 아님. 다른 예약을 밀어내거나 기존 다른 fingerprint를 덮어쓰지 않는다. 늦게 도착한 Doze 알림/이미 게시된 알림은 이번 범위에서 recall하지 않는다.
- 마무리 알림 count/fingerprint 등 전체 8일 계획 갱신은 기존 foreground에 맡긴다. cold 즉시 wrapup 재조정 완료로 간주하지 않는다.
- 이 계약은 현재 실제 cold runtime에서 호출하지 않는다. 테스트에서 원본 transaction 결과에 연결하여 검증한다. 결정 자체는 사용자·스토리지·알림에 side effect가 없다.

## 4B-2 진입 조건
현재 Debug APK의 컴파일된 실제 dependency에서 manager/storage/Notification model JVM descriptor를 확인한다. 이후 request-bound native adapter 설계: native main-thread에서 단일 claim/currentKey/동의/no Activity/deadline + fresh scope/day/revision/preferences 및 전체 inventory/권한/시각 재확인 후 한 건만 적용. 실제 스토리지/타이머의 일관성, boot restore, 충돌·부분 실패·timeout을 검증하고 기록 저장과 알림 처리 결과 분리(기록은 rollback/중복 재시도하지 않음). 정상 앱 복귀 회복 유지. 결과가 불확실할 때 성공을 주장하지 않는다. 범용 bridge·토큰 복제·native 기록 원본은 금지.

## QA — 실제 기기 NOT RUN
격리 Debug 설치 + 테스트 guest/member, 기존 설치 삭제 금지.
| ID | 상황 | 기대 |
|---|---|---|
| B01 | 앱 프로세스 종료(강제 중지 아님) 후 알림 예정 이전 완료 | 원본 기록 저장, 해당 예약 제거 및 해당 시각 미수신 |
| B02 | 예정 이전 취소 | 동일 소유 ID·시각·알림 본문으로 1건 재예약 및 실제 수신 |
| B03 | 지난 시각, near-due, DST gap, 회원/기기 자정·시간대 | 잘못된 날짜/즉시 게시/중복 알림 없음 |
| B04 | 다른 계정/동일 ID/외부 종류/보존 storage·visible/중복/48 cap | 변경 보류, 다른 예약 보존 |
| B05 | 알림 OFF, 권한 차단·철회·복구, 정확/일반 권한 | 신규 권한 창·설정 강제 이동 없음, 이전 권한 철회/기기 OFF 시 즉시 취소 보장하지 않음, 정상 앱 복귀 처리 |
| B06 | 동의 철회·계정 변경·연속 탭·Activity 시작·deadline·부분 실패 | 기존 원본/Outbox 보호, 잘못된 변경 금지, 정상 앱 복귀 재조정. 저장 성공+알림 실패는 저장됨으로 표시, 필요 시 알림만 앱 확인 안내; opt-out/already absent를 실패 안내하지 않음 |
| B07 | 실제 OEM 절전·재부팅·일반 프로세스 종료·force-stop 구분 | OS 허용 범위만 검증, 과도한 보장 없음 |
| B08 | wrapup·미래·다른 습관/테마·위젯 V12.2 및 Release 읽기 전용 | 기존 계약 유지 |

B01~B08은 4B-2 이후 실기기 인수 기준이다. 4B-1에서는 자동화와 binary API evidence만 해당한다. #189 및 출시 게이트는 open.
