# 삼성 인터넷 웹페이지 강제 다크 A/B/C 실험

**상태:** 실험 구현 / 삼성 인터넷 실기기 미검증 / 운영 앱 미변경

## 배경

사용자가 삼성 인터넷의 '웹 콘텐츠에 어두운 화면 모드 강제 적용'만 OFF로 변경하면, **브라우저 자체 다크 ON + 별하루 앱 다크 ON** 상태에서도 Chrome과 거의 동일한 B2 팔레트가 보이는 것을 실기기로 확인했다. 이는 삼성 인터넷 강제 다크 후처리가 별하루 화면의 색상 차이에 주요 원인임을 뒷받침한다.

## 실험 범위

PR #33 B2 팔레트 커밋 `4fff81b452da6bd54ce754a3160f98c71b39a7eb`을 시작점으로 테스트 브랜치를 분리한다. 실제 앱 홈/로그인/데이터 저장은 변경하지 않는다.

개발 서버 또는 Vercel Preview에서만 접근 가능한 다음 진단 URL을 각각 **새 문서로 로드**하여 비교한다.

| 경로 | 선언 | 목표 |
| --- | --- | --- |
| `/diagnostics/force-dark/baseline` | 현행 `html: light`, `.byeolharu.dark: dark`, 메타 color-scheme 미선언 | 기준 |
| `/diagnostics/force-dark/declared` | `<meta name="color-scheme" content="light dark">`, `html: light dark`, 앱 dark | 자체 다크 지원 안내 |
| `/diagnostics/force-dark/optout` | 위 메타 + `html: only light`, 앱 `only light` | 자동 색 변환 제외 실험 |

모든 경로의 샘플 본문/색상 토큰은 동일하다. 메타는 Next.js `generateViewport`에서 출력하고, CSS 변경은 테스트 컴포넌트가 존재하는 문서에서만 활성화한다. 페이지는 고객 데이터/인증/분석을 읽거나 수정하지 않으며, 운영 환경에서는 404를 반환한다. 검색 로봇 차단도 명시한다.

**주의:** color-scheme 선언은 브라우저 사용자 설정을 변경하거나 강제 다크를 모든 버전에서 막는 API가 아니다. `getComputedStyle()`은 브라우저의 최종 픽셀 후처리를 반영하지 않을 수 있으므로 스크린샷을 반드시 함께 확보한다. `only light`은 애초에 사이트의 다크 디자인을 위한 일반 권장 설정이 아니라 강제 변환 실험이다.

## 실기기 절차

1. 동일 삼성 인터넷 앱에서 **OS 다크 ON, 삼성 브라우저 다크 ON, 웹 콘텐츠 강제 다크 ON**으로 설정하고 세 진단 URL을 차례로 연다. 페이지 자체는 고정된 B2 다크 샘플이다.
2. A/B/C 각각 패널 배경/금색/날짜 테두리가 어떻게 보이는지 스크린샷 촬영. `계산된 CSS 색상` 출력은 편의를 위해 제공되지만 계정·습관 데이터 없음.
3. 조건을 그대로 두고 Chrome에서 같은 URL을 열어 회귀/시각 차이를 비교.
4. 마지막으로 삼성 인터넷의 웹 콘텐츠 강제 다크만 OFF로 바꿔 같은 비교를 반복하면 설정 기반 정상 대조군을 확보할 수 있다.

## 판정

- B 또는 C에서 **삼성 인터넷 강제 다크 ON만으로** 색상이 Chrome에 실질적으로 가까워진다면, 기기/버전별 효과가 있는 옵션을 별도 PR에서 실제 앱 전체에 적용할지 검토한다.
- 세 옵션이 모두 변색되면 **사이트 코드만으로 해당 브라우저 강제 변환을 통제할 수 없다는 실기기 결과**로 남기고 전역 색상 반전/밝기 보정 등을 추가하지 않는다. 사용자가 검증한 강제 다크 OFF를 권장한다.
- 자동화 CI는 세 경로의 출력/조건부 404/키보드·레이아웃·색상 계산값에 한정되며 **삼성 강제 다크 후처리는 검증할 수 없다.**

참고: [삼성 공식 다크 모드 설명](https://developer.samsung.com/browser/blog/en/2020/12/15/dark-mode-in-samsung-internet), [Next.js generateViewport](https://nextjs.org/docs/app/api-reference/functions/generate-viewport).

실험 승인 전에는 PR #33 및 이 실험 PR 모두 병합·Publish하지 않는다.
