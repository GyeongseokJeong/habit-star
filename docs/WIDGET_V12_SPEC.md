# 위젯 V12.0 — 빠른 실천과 명시적인 앱 진입

2026-11-25 · 사용자 승인 방향 · #189, #218 후속. CI 및 실기기 검증 필요.

> 아래는 당시 V12.0~12.2 설계 이력이다. 2026-11-29 사용자 승인으로 완료·별점 0~5의 명시적 위젯 취소를 허용한다. 1~4점 제한과 read-only release 설명은 역사적 내용이며 현재 계약은 [아키텍처](ARCHITECTURE.md)를 따른다.

## 제품 원칙 및 동작
위젯은 한 번의 터치로 기록하고 앱은 별점·메모 편집을 담당한다. #218 상세 진입을 철회하며 알림 상세 진입은 유지한다.

| 영역 | 동작 |
| --- | --- |
| 좌측 홈 | 정상 앱 실행, 특정 상세 강제 진입 없음 |
| 시간대·카운트·빈 영역 | 정보 표시 |
| 습관명·아이콘·행 여백·체크 | 기존 동일 명령: 미완료 0점→완료 5점, 완료 0·5점→미완료 0점 |
| 쓰기 키 없는 행(1~4점 등) | 변경 없이 앱에서 세부 기록 수정 안내; 자동 앱 실행 없음 |
| 이전 #218 상세 탭 | 무시 |
| 만료·실패·충돌·계정 불일치 | 기존 검증/안내; 낙관적 완료 표시 금지 |

## UI
- 네이비/아이보리·골드 유지. 헤더 48dp, 좌측 44×48dp 홈 터치 영역, 골드 22dp 아웃라인. 시간대 14sp 한 줄 말줄임, 진행률 우측.
- 좌측 6dp, 우측 8dp, 상하 4dp. 행 최소 48dp, 제목 14sp 최대 두 줄, 체크 22dp 및 Debug 48×48dp 유지.
- 표시 행 1~2개이고 host minimum height ≥ 60 + count×60 dp이면 행 최소 60dp, 나머지 48dp. 런처가 카드 물리 크기를 결정하므로 강제 축소 없음. 큰 글자·긴 제목은 자연스럽게 확장, 스크롤 유지.
- 예시 미리보기도 같은 홈, padding, sparse 규칙 적용; 실제 크기 근사이며 비조작.
- 기존 두 provider/위젯 ID, resize, 시간대, 숨김, 아이콘, 동의, 테마 및 release 읽기 전용 유지.

## 구현 및 안전성
- #218 detail navigation bridge/해석/secret 생성 및 폐기 기능 전용 테스트 제거. 기존 알림 navigation 복원. 다음 generation 저장에서 오래된 detail-secret만 제거. stale detail tap 무시, adapter URI /v12/로 갱신.
- 전체 행에 동일한 opaque actionKey, 기존 warm/cold native claim/동의/만료/계정/원본 revision/version 및 Outbox 재사용. 쓰기 키 없는 경우 안내만. 별도 원본, 인증 변경, 권한 추가 없음.
- 일반/희소 × Debug/read-only 네 가지 행 레이아웃. 홈은 immutable Activity PendingIntent.

## 완료 기준
1. Debug warm/cold에서 행·아이콘·제목·체크 모두 완료/취소, 중복 저장 없음.
2. 홈만 앱 실행, 보호된 1~4점 기록·메모 및 설정 보존.
3. #218 업데이트 후 stale tap 안전, 기존 위젯 ID/설정 유지.
4. 2×2/2×3/3×2/4×4, 0·1·2·3개 이상, resize, 스크롤, 긴 제목·큰 글꼴, 아이콘/완료 숨김, 테마 및 예시 미리보기 확인.
5. 기존 알림 상세 진입, 성장, 회원 Outbox 및 앱 재진입 동기화 회귀. release 읽기 전용 확인.
6. CI/Android 빌드 및 실기기 검증 후 완료. 즉시 cloud 전송/알림 재조정·force-stop은 별도 미검증.

## 검토 기록
1차 UX/제품: 상세 진입으로 체크 의도와 실행 불일치 → 한 번의 터치, 명시적 홈 분리.
2차 아키텍처/데이터/QA: 오래된 캐시/보호 별점/좁은 위젯 및 큰 글꼴 → 기존 쓰기 guard, stale detail 무시, 보수적 host min height 기준, 물리 크기 유지.
동일 모델 역할별 검토이며 독립 에이전트 실행 없음.

## V12.1 설정 마감 — 2026-11-25
- #219 main 병합 46743e9, PR CI/Android 및 main CI 성공. 사용자 실기기 체크리스트 10/10 정상. 스크린샷상 좁은 라이트 위젯/세로 확장 다크 위젯/설정 표시 확인. 긴 위젯의 하단 공간은 호스트 크기 제약, 추가 레이아웃 변경하지 않음.
- 스위치 ON 불투명 보라색(다크 #9180B8 / 라이트 #78639F), OFF 회색(다크 #50576A / 라이트 #C8BFB3). 기존 white thumb, native Switch checked/accessibility, 48dp 행, draft/preview/apply 동작 유지. 플랫폼 반투명 트랙 tint 대신 checked selector, splitTrack false.
- 오래된 Debug 테스트 안내 제거. 개인정보 표시 동의 설명 유지. release 읽기 전용 제한 안내는 정식 직접 기록 활성화 시 제거. 데이터/기록/위젯 레이아웃 변경 없음. CI 및 실제 양 테마 ON/OFF 확인 필요.

## V12.2 토글 비율 미세조정 — 2026-11-25
- #220 병합 후 다크 실기기에서 ON/OFF 색상 구분 및 오래된 테스트 문구 제거 확인. 사용자 피드백 핵심은 ON 왼쪽 과도한 여백이며 색상 변경 요청 아님.
- V12.1 OEM 기본 thumb 제거, 자체 18dp 흰색 원형 centered layer 적용. 트랙 48×26→40×24dp, 양 끝 2dp, 위아래 nominal 3dp. 처음 제안한 44dp보다 더 컴팩트한 40dp 선택; 기존 Android Switch의 intrinsic width 및 padding 계산을 고려한 설계. ON/OFF 기존 색상 및 48dp 이상 행 터치, native checked/drag/접근성, 설정 저장/미리보기, release 안내 유지. 실제 OEM 렌더링과 양 상태 좌우 여백은 실기기 검증 필요.

## STEP 4A 안정화
V12.2 디자인 동결. [안정화 명세 및 검토](WIDGET_STABILIZATION_STEP4A.md). resume 권한 조회와 최신 snapshot 예약 분리, 자동 예약 queue stale guard, cold→reopen→Outbox→SyncEngine mock 및 알림 계획 통합 테스트. 실제 cold 알림 취소/클라우드 왕복/상용 활성화는 후속 게이트.
