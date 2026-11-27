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

---

# STEP 4B-2 — Debug 종료 상태 알림의 실제 네이티브 연결

기준 main `785e7bcc` (#227 병합). 4B-1 위 안전 계약에 실제 Debug 연동을 추가한다. **Release 직접 기록 비활성·V12.2 UI·원본/Outbox·회원 auth·wrapup 정책은 유지한다.** 사용자 습관 저장을 알림 성공으로 정의하지 않는다.

## 설계 결정 / 실패 경계

- 기존 `runColdWidgetPractice`의 repository commit 성공 이후만 실행. 새 저장소/토큰 복제/네트워크/Activity 호출/새 권한 요청 없음. 준비 단계는 같은 오프라인 WebView의 기존 poll에서 한 번만 native inventory를 요청한다. 응답 데이터는 JSON 문자열 전체를 인용하여 전달하고 다른 저장 알림은 ID만, 목표와 정확히 일치하는 payload만 반환한다. JavascriptInterface는 기존 allowed() 하나뿐.
- native adapter는 request-local; 현재 claim/currentKey/동의, Debug, 동일 기본 application process의 main thread, **MainActivity가 한 번도 생성되지 않은 프로세스**에서만 예약 변경 허용. 과거 bridge executor가 남을 수 있는 Activity만 종료한 과정은 기록 저장 가능하더라도 알림 적용을 보류한다. prepare 후 repo load·generation·identity·prefs·day/revision 재확인; generation/revision이 바뀌거나 신선도를 확인 못하면 이전 summary/handle도 publish하지 않는다. wall 및 monotonic deadline을 WebView 시작에 고정, 시간대/clock drift 및 예정 2초 이내(취소도) 보수적 보류. 기존 6.5초 WebView timeout을 늘리지 않음.
- 8.3.1 `NotificationStorage.getSavedNotificationIds/getSavedNotificationAsJSObject`로 매 key의 canonical 정수 ID와 decoded/parsed ID 대조. 전체 raw store·scheduled classification·visible IDs·권한(POST 및 exact)·기존 channel·실제 target PendingIntent token을 수집, 512개/512KiB 상한. 저장 목록만으로 예약 생성을 결정하지 않고 같은 inventory를 다시 읽어서 drift를 막음. 다른 습관·계정·미래·wrapup은 변경하지 않는다. Native owner/category/day/ID 및 title/body/schedule/fingerprint를 canonical 형태로 독립 재검증; Java UTF-16 FNV-1a와 JS 실제 planner의 16개 JVM vector 비교. [TimedNotificationPublisher](https://github.com/ionic-team/capacitor-local-notifications/blob/0fbde4878e97e9947d5413737252012befbab139/android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.kt), [RestoreReceiver](https://github.com/ionic-team/capacitor-local-notifications/blob/0fbde4878e97e9947d5413737252012befbab139/android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/LocalNotificationRestoreReceiver.kt)는 같은 프로세스의 동기 BroadcastReceiver. 최종 APK의 relevant component process 검증 추가.
- 실제 변경은 `LocalNotificationManager.cancel(PluginCall)` (정확히 1 ID), `schedule(PluginCall,List)` (정확히 1 payload) → upstream `storage.appendNotifications`. 로컬 SingleCall에서 reject가 resolve/ID 반환에 우선하고 예외/읽기 결과를 검증한다. 신규 PendingIntent를 만들거나 취소하는 별도 구현/AlarmManager 직접 변경/private storage key 접근 없음. FLAG_NO_CREATE 조회만 pinned manager의 명시적 receiver/requestCode/flags와 일치. 이미 저장되지 않은 ID에 남은 token은 복구를 강행하지 않는다. restore 부분 실패 시 원래 비어 있었던 당일 target만 현재 소유/안전/동의가 유지될 때 best-effort 보상 cancel; 기록은 rollback하지 않음. foreground 기존 재조정은 보존.
- **잔여 위험:** 실제 예약 OS·store apply는 원자적이지 않다. 특히 프로세스 사망이 manager.schedule과 저장 사이 발생하면 orphan token/알림이 남을 수 있고, 동일 fingerprint인데 token 없는 경우나 다른 계정/opt-out에서 orphan은 기존 foreground diff로 완전 복구된다고 보장하지 못한다. PendingIntent 존재 증거는 실제 AlarmManager 등록/수신 증거가 아니며, 권한/시각/OS delivery는 마지막 확인 이후에도 변할 수 있다. B01~B08 및 kill/boot/권한 실기기 확인 전 출시 직접 기록 gate 유지. 실기기에서 orphan/불일치가 관찰되면 추가 보상/복구 설계 전 Release 금지.
- 저장 성공 & 알림 불확실/실패: 기존 위젯 summary 유효하면 publish 후 한 번 안내(기록은 저장, 알림은 앱에서 확인). summary가 신선하지 않으면 위젯과 알림 확인 통합 안내. opt-out/unconfigured/past/visible 아닌 already-absent/scheduled의 증거 충족/정상 계획 우선순위 제외/near-due/알림 권한 차단은 불필요 알림 경고 없음. 소유권/claim/기한 변경으로 저장 결과를 확정할 수 없는 종료는 기존 중립 안내. 새 UI/자동 권한 요청 없음.

## 이해관계자 하네스 (android-native + data + implementation)

- 1차 독립 Android/QA, architecture/security/data, PM/UX/user. 대안: A 기존 foreground만 유지(알림 즉시 조정 불가), B Activity/일반 Capacitor bridge/직접 AlarmManager(권한·원본·경쟁 위험), C offline request-bound polling + pinned native manager(채택). Android의 구체적 SDK API/PluginCall·storage append 계약, 보안의 다른 ID collision/redaction·부분 실패·MainActivity executor 경합, UX의 commit/알림 결과 분리·단일 안내를 채택. 구현/클린코드 관점: Key 분리, 기존 planner와 prefs key 공용, 오프라인 원본 write 재사용.
- 2차 독립 코드 교차 검토. Android/QA exact Kotlin getter·call parser·PI identity·source checks 일치, JDK 없는 local JVM/실기기 N/E. 보안 P1 clock rollback: open 시 고정 monotonic deadline 수용, process manifest 검사 보강. UX/보안 stale summary 경합: 준비 실패 포함 fresh revision/generation 확인, stale이면 summary 미게시, 회귀 테스트 추가. 원본/Outbox 영향 없음(기존 저장 동작 유지), 다른 계정/범용 mutation transport 없음. 남은 hard-crash/OS evidence는 Debug에 한정하고 Release gate로 열어 둔다. 핵심 이견은 수정 및 재평가로 해소(현 Debug 범위의 신규 P0/P1 없음). 실제 연구 및 실기기 N/E.
- 로컬 관련 Node plan/회귀 40개, native-template source contracts, manifest 두 테스트 실행. 전체 CI, compiled API, JVM identity vectors 및 APK/AAB 결과는 PR 확인. 원본 DB/운영/실제 기기 변경 없음.

## B01~B08 확장 인수 (NOT RUN)
- B01/B02: 테스트 guest/member, 예약 전 PID 종료(강제 중지 아님) 이후 위젯 cold 실행; 새 PID에서 MainActivity 미생성 확인. 저장/별점/메모/Outbox 유지, 선택된 당일 알림만 취소·재예약, 예정 시간 *실제* 미수신/수신, 다른 예약 및 wrapup·미래 보존. 기존 프로세스에서 MainActivity만 종료 시 실제 알림 작업 보류 및 앱에 돌아오면 기존 재조정.
- B03/B04/B05: 같은 ID의 다른 owner/category, malformed key/decoded ID, orphan/missing token, visible/권한·channel·exact 변경, 48 cap 및 저장 상한, DST/자정/시계 역행, 2초 margin에서 변경 없음 또는 안전 보류. 정상 opt-out/정책 no-op 무경고.
- B06/B07: manager 성공+storage 실패/읽기 실패, schedule 실패/compensation, native TTL/renderer 종료/Activity 시작/동의 철회/계정 전환/프로세스 kill/재부팅·Doze. 원본 저장 성공 vs 알림 결과별 단일 안내, stale summary 미게시, 중복 기록/자동 재시도/외부 알림 수정 금지. 실제 AlarmManager·수신·복구 결과 별도 확인. 업데이트 설치 시 기존 앱 삭제/데이터 초기화 금지.
- B08: Release build에는 cold JS bundle 없음, Debug 실험 외 기존 V12.2 위젯 읽기 전용 및 일반 앱 알림 유지. STEP 4C 회원 실제 클라우드, 4D 통합 인수 및 #189/출시 gate는 열린 상태 유지.

---

## D04 P1 재발 대응 — 최근 앱 종료 및 실제 프로세스 종료 구분

기준 main `a967` / 2026-11-27 사용자 실기기 보고: 위젯에서 오늘 습관을 완료 처리했는데 해당 예정 알림이 울렸다고 보고됨. **D04의 기존 사용자 결과는 FAIL**로 기록하며 수정본의 하위 시험은 모두 NOT RUN이다. 정확한 수신 알림의 앱 variant·개별 습관/마무리 종류·설정 시각·PID 생존 여부는 미확인이다. 단순히 마무리 알림이나 다른 APK일 가능성을 근거로 통과 처리하지 않는다.

### 원인 가설과 변경 검증 기준

- 기존 `ACTIVITY_EVER_CREATED` 기준은 MainActivity가 한 번이라도 생성된 동일 프로세스에서 알림 transport를 거절했다. Android 최근 앱 목록 제거 또는 Activity 종료 후에도 PID 및 Capacitor worker가 생존할 수 있으므로 위젯 기록 저장은 성공하면서 알림 취소/복구가 보류될 수 있다. 이는 재현 가능한 코드 경로이며 실제 사용자 기기가 그 상태였다는 확정 증거는 아니다.
- 기존 무조건 차단 조건의 완화는 해당 프로세스에서 활성 Activity가 없고, 종료된 각 Activity의 이전 Capacitor 작업 스레드가 더 이상 살아 있지 않다는 사실을 확인한 경우에만 허용한다. `Bridge.onDestroy()`의 `quitSafely()` 호출 자체, 임의 지연, 큐 중간 sentinel 또는 최신 Activity 한 개의 종료만을 전체 작업 종료 증거로 간주하지 않는다. 종료 상태·worker를 확인하지 못했거나 기존 Activity 작업이 진행 중이면 저장된 기록은 유지하고 알림만 안전하게 보류한다.
- 같은 습관/오늘/계정 범위의 이전 정상 알림 제목·시각이 기기에 남아 있을 수 있다. 완료는 저장된 원래 payload의 실제 fingerprint/소유권/one-shot 미래 시각을 검증한 기존 예약만 취소하며, 완료 취소는 현재 습관 설정으로만 복구한다. 이전 시각·제목을 복원하지 않는다.
- 이 절은 4B-2의 "MainActivity가 한 번도 생성되지 않은 프로세스"에 한정한 보수적 정책을 대체하는 **재검증 기준**이며 원본, 계정, 전체 inventory·stable ID·권한·deadline·단일 claim 및 Release 읽기 전용 보호는 변경하지 않는다. 아직 안전하게 확인하지 못한 상태에서 프로세스 재시작/토큰 조작으로 우회하지 않는다.
- 새 진단은 Debug의 고정된 단계/사유 코드로만 수집한다. 예: `worker-draining`, `prepare-inventory-invalid`, `inventory-changed`, `cancel-verified`, `restore-verified`, 권한/시간/기한 보류. 원시 UID, 습관 제목/ID, 토큰, 날짜별 기록/메모, 알림 payload, DB/전체 logcat, 예외 메시지를 수집하거나 화면에 노출하지 않는다. 성공 코드 `cancel-verified`/`restore-verified`는 네이티브 재조회에서 확인한 저장소·토큰 상태이며 실제 OS 예약·전달 결과를 증명하지 않는다. 두 결과는 별도 근거로 남긴다.

### 수정본 D04 하위 시험 매트릭스

분리된 Debug 시험 설치와 가상의 습관만 사용한다. H1은 오늘 5~10분 후 미완료 알림 ON, H3은 다른 습관의 미래 알림 ON, H4는 별도의 미래 알림 ON 완료 상태로 준비한다. 같은 시간대라면 기존 마무리 알림과 시험 대상 알림 시각을 달리한다. 예약 전후 개별 알림의 종류 및 Debug 앱 패키지를 확인하고, 원래 습관 설정·별점·메모·Outbox 및 다른 예약 상태를 비교한다. 수정본의 결과는 사용자 검증 전 모두 **NOT RUN**.

| ID / 심각도 | 조작 | 합격 기준 | 수정본 결과 |
|---|---|---|---|
| D04-a P1 | 홈/최근 앱 화면에서 Debug Activity를 닫되 PID가 생존하는 사례. 이전 Capacitor worker 완전 종료가 확인된 뒤 H1 위젯 완료 | 기존 PID에서 앱을 재실행하지 않고 오늘 H1 기록 저장·해당 예약 1건 취소. H1 예정 시각 실제 미수신, H3 실제 수신 및 나머지 미래/마무리 예약 보존 | NOT RUN |
| D04-b P1 | 홈 상태에서 `adb shell am kill <Debug 패키지>` 후 `pidof`로 부재를 확인, 새 프로세스의 위젯 H1 완료 | 앱 Activity를 새로 열지 않고 D04-a와 동일 결과. 최근 앱 닫기 또는 `am force-stop`을 실제 프로세스 종료 시험으로 대체하지 않음 | NOT RUN |
| D04-c P1 | 앱 Activity 실행 중 또는 백그라운드의 기존 bridge가 정상 동작하는 상태에서 H1 위젯 완료 | 기존 정상 앱·위젯 경로가 기록과 알림을 재조정. 중복 취소/저장 없이 해당 H1 알림 미수신, 다른 알림 정상 | NOT RUN |
| D04-d P1 | 별도의 H4 예약을 앱에서 완료 처리해 제거한 뒤 각각 worker 종료된 cached PID와 실제 PID 종료 상태에서 신선한 위젯 핸들로 완료 취소 | 오늘 H4 예약 동일 소유 ID/시각으로 1건 복구, 앱 재진입 전 예정 시각에 실제 1회 수신. H4 기록은 0점/미완료, 기존 메모 유지. 다른 습관/계정/마무리/미래 예약 변경 없음 | NOT RUN |
| D04-e P0/P1 | Activity 생성/종료가 겹침, 이전 worker 미확인·아직 진행 중, 로그인/로그아웃/동의 철회·오래된 핸들·연속 탭 | native 작업 보류 또는 현재 검증된 단일 경로만 실행. 다른 계정/원본/Outbox 손상 없음(P0); 백그라운드 알림 실패는 기록 성공과 구분해 단일 안내하고 정상 앱 복귀 후 재조정(P1) | NOT RUN |
| D04-f P0/P1 | 타 계정·외부 종류와 ID 충돌, malformed inventory, orphan/부분 실패·시계/시간대·near-due·채널 차단/권한 철회, 재부팅/절전 | 대상 외 예약/원본을 변경하지 않음(P0), 불안전한 즉시 게시·중복 예약 금지와 고정 사유 안내(P1). 정확 권한 없으면 허용된 일반 예약 정책 유지. 이미 전달된 알림을 회수한다고 보장하지 않음 | NOT RUN |
| D04-g P1 | 격리된 테스트 서명 Release APK의 위젯에서 실제 행동 반복, 앱 안의 일반 알림 회귀 | 기존 Release 위젯 읽기 전용 유지(직접 기록이 발생하면 P0), 앱 자체 기록/알림·웹 동작 유지 | NOT RUN |
| D04-h P1 | 가상의 같은 습관/오늘/계정에 이전 정상 제목·미래 예정 시각의 예약이 남은 상태를 격리 fixture로 준비하고 현재 시각/제목이 다른 위젯에서 완료 → 별도 전제하에 완료 취소 | 이전 정상 payload의 미래 예약만 취소, 이전 시간에 실제 알림 없음. 완료 취소는 현재 유효한 시각의 예약만 복구(과거·미설정 시 복구하지 않음). fingerprint/소유권이 불명확한 예약은 변경 금지 | NOT RUN |

### 결과 기록 및 출시 차단

- 실제 시험 APK의 variant·패키지·source SHA·artifact SHA256, Android/런처/System WebView, 일반·정확 권한, Activity 생명주기 및 PID, 조작과 예상/실제 알림 시각, 고정 코드(있다면), 각 하위 시험의 PASS/FAIL/NOT RUN/BLOCKED를 기록한다. 실제 개인 데이터는 첨부하지 않고 가상 시험 데이터만 사용한다. 시험 앱의 AlarmManager 등록 확인 및 실제 예정 시간 미수신/수신을 둘 다 확인한다. PendingIntent 토큰/저장소/코드 결과만으로 OS 전달을 증명하지 않는다.
- D04-a/b/d/h는 앱을 다시 열기 전 예약/전달 기준을 통과해야 한다. 정상 앱 재진입으로 알림이 복구된 사실만으로 D04를 통과 처리하지 않는다. 최근 앱 삭제 및 제조사 절전으로 worker 종료 조건이 다름을 고려하고 불가한 실험은 BLOCKED로 기록한다.
- 이 재발 수정은 #189 및 #230의 실기기 인수 게이트를 닫지 않는다. 현재 D04 사용자 보고 실패 및 수정본 미검증 상태를 유지한다. 일반 권한 확인 회귀는 [첫 알림 권한 R01~R08](ANDROID_NOTIFICATION_FIRST_PERMISSION_TEST.md)에서 별도 기록한다. P0/P1 미해결 또는 필수 실기기 검증 미완료 시 Release 직접 기록 활성화/정식 출시는 보류한다.
