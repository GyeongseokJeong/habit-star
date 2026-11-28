# 별하루 Android 0.1.3

다음 Play 테스트 배포 후보: `0.1.3` / versionCode `4` / `app.byeolharu.android`.
기존 Play 업로드 서명키와 동일 패키지를 유지한다. 직전 생성한 서명 AAB는 0.1.2 / code 3이었다. Play Console의 모든 트랙·앱 번들에서 실제 최고 사용 코드를 서명 전에 확인한다.

## Google Play 변경사항 (ko-KR)

```text
개인정보처리방침과 계정 삭제 요청 메뉴를 추가했습니다.
개인정보 보호와 계정 관리 안내를 읽기 쉽게 정리했습니다.
```

## 배포 순서

1. [#240](https://github.com/GyeongseokJeong/habit-star/pull/240) 및 버전 변경 PR의 CI, main 커밋의 verify/cloud 결과를 확인한다.
2. 별도 승인 및 백업/복구·마이그레이션 이력 확인 후 운영 Supabase 신규 마이그레이션을 적용하고 스키마 및 단건 삭제 절차를 검증한다. 실사용자 삭제로 테스트하지 않는다.
3. Play 최고 사용 versionCode 확인 후 main의 Android Shell PoC 수동 실행에서 `sign_internal=true`, `highest_play_version_code`에 실제 확인한 값을 입력한다. 이전 업로드 코드를 추정해서 검증을 우회하지 않는다.
4. 서명 AAB의 패키지·코드·버전·소스 SHA·무결성·위젯 활성화 검증 후 내부 테스트에 업로드한다. 테스트 서명 APK는 Play 설치본 위에 설치하지 않는다.
5. 실제 Play 업데이트 설치 후 기존 회원/비회원 기록·로그인·개인정보처리방침 화면·탈퇴 요청 메일 작성(발송하지 않음)·위젯 완료/취소·알림 취소/재예약·라이트/다크를 인수 검증한다.
6. 공개 개인정보처리방침/계정 삭제 URL, 데이터 보관 및 삭제 정책과 Data safety·앱 콘텐츠 선언·스토어 등록 자료를 확인한다.
7. 개인 개발자 계정에 적용되는 폐쇄 테스트 조건(최소 12명, 연속 14일)을 Play Console에서 확인하고 충족한 후 프로덕션 액세스를 신청한다. 내부 테스트만으로 대체하지 않는다.

실제 운영 DB 변경, 서명, 업로드 및 공개 출시 승인은 개별 단계로 처리한다. CI 성공과 실제 기기·Console 검증은 구분한다.

공식 참고: [Android 버전 관리](https://developer.android.com/studio/publish/versioning), [개인 개발자 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465), [계정 삭제 요구사항](https://support.google.com/googleplay/android-developer/answer/13327111).
