# 별하루 개발 헌장

모든 변경은 **Project Constitution → Agent Skills → Validation → GitHub CI** 순서로 검토한다. 제품 판단은 [제품 철학](docs/PRODUCT_PHILOSOPHY.md), 화면은 [디자인 시스템](docs/DESIGN_SYSTEM.md), 데이터 흐름은 [아키텍처](docs/ARCHITECTURE.md), 검증·배포는 [개발 규칙](docs/DEVELOPMENT_RULES.md)을 따른다. **V3.2 별자리 성장의 확정 정책·아트 합격 기준은 [시그니처 별자리 설계](docs/CONSTELLATION_V3_2.md)를 우선 확인한다.** 사용자 기록을 동의 없이 삭제·초기화·이전하지 않는다.

## 하네스 3.2 — 이해관계자 검토

제품/사용자 영향 작업은 [Stakeholder Harness](docs/STAKEHOLDER_HARNESS.md)의 route·modifier를 선택하고 관련 역할의 SKILL.md를 읽는다. 시안은 PM·UI·UX·사용자, 신규 기능 발굴은 제품·디자인·사업·마케팅·사용자 관점에 리서치·지표 검토를 추가, 개별 기능은 PM·UX·사용자 및 영향에 맞는 전문가를 참여시킨다. 필요한 경우 BM·마케터를 추가한다. 아키텍처·코드 리뷰·구현·서버 운영은 관련 기술 전문가를 선정한다. 신규 기능·사용자 영향 결함·출시에는 QA 역할을, 데이터/인증/동기화 및 출시에는 보안 역할을 포함한다. 실제 데이터/인증/동기화 변경에는 `data` modifier가 필수이며 `security`만으로 대체하지 않는다. **Android 네이티브/위젯/시스템 알림/APK·AAB 검증은 `android`, 원화·테마·별빛 카드 아트는 `art`, 실제 사용자 근거는 `research`, 제품 지표·실험은 `analytics` modifier 또는 대응 route를 사용한다.** 일반 UI/웹만 변경하면 불필요한 역할을 호출하지 않는다. 단순 CI/오타는 패널을 생략한다. `node scripts/select-stakeholders.mjs <route> [modifier ...]`는 추천 역할과 스킬을 출력하며 실제 호출을 자동 실행하지 않는다.

역할 스킬: [stakeholder-panel](.agents/skills/stakeholder-panel/SKILL.md) · [product-planner](.agents/skills/product-planner/SKILL.md) · [ui-specialist](.agents/skills/ui-specialist/SKILL.md) · [ux-specialist](.agents/skills/ux-specialist/SKILL.md) · [business-strategist](.agents/skills/business-strategist/SKILL.md) · [growth-marketer](.agents/skills/growth-marketer/SKILL.md) · [user-perspective](.agents/skills/user-perspective/SKILL.md).

중요 시안·기획·설계·코드 리뷰는 독립 검토 → 상대 제안의 구체적 반박 → 근거 기반 재반박 → 수정 → 동일 기준 재평가를 한 라운드로 하여 최소 2회, 최대 3회 수행한다. 조기 종료에는 근거와 이견 해소 기록이 필요하며, 3회 후에도 핵심 위험이 남으면 보류한다. 간단한 CI/오타는 1회로 제한 가능하다. 실제 서브에이전트가 없으면 동일 모델의 관점 검토라고 명시한다. 실제 사용자 조사·실기기 검증과 혼동하지 않는다. 승인 범위 내 변경만 실행하며, P0/P1 및 기존 보호 스킬 게이트는 평균 점수로 상쇄하지 않는다. 제품·시안 리뷰는 [검토 절차](docs/STAKEHOLDER_HARNESS.md)를 따르고 PR에는 참여 역할·결정·검증·잔여 위험을 남긴다.

기술 역할 스킬: [software-architect](.agents/skills/software-architect/SKILL.md) · [clean-code-specialist](.agents/skills/clean-code-specialist/SKILL.md) · [senior-fullstack-developer](.agents/skills/senior-fullstack-developer/SKILL.md) · [server-operations-specialist](.agents/skills/server-operations-specialist/SKILL.md). 기술 역할은 기존 보호 스킬을 대체하지 않는다.

신규 전문 역할 스킬: [senior-qa-engineer](.agents/skills/senior-qa-engineer/SKILL.md) · [senior-android-native-developer](.agents/skills/senior-android-native-developer/SKILL.md) · [illustration-art-director](.agents/skills/illustration-art-director/SKILL.md) · [security-privacy-specialist](.agents/skills/security-privacy-specialist/SKILL.md) · [ux-researcher](.agents/skills/ux-researcher/SKILL.md) · [product-data-analyst](.agents/skills/product-data-analyst/SKILL.md). 총 16개 역할이며 QA/보안은 검증·차단 판단을 강화할 뿐 보호 스킬이나 사용자 승인 권한을 대체하지 않는다. 연구/분석 역할은 실제 데이터와 추정치를 구분하고 신규 계측·개인정보 수집·실제 참가자 연락에는 별도 승인이 필요하다.

## 필요한 스킬만 선택

| 작업                  | 읽을 스킬 (`.agents/skills/<name>/SKILL.md`)                              |
| --------------------- | ------------------------------------------------------------------------- |
| UI 변경               | design-guardian + accessibility-auditor                                   |
| 신규 기능             | feature-builder + quality-gate                                            |
| 데이터 변경           | data-guardian + quality-gate                                              |
| UI 포함 기능          | feature-builder + design-guardian + accessibility-auditor + quality-gate  |
| 데이터 변경 포함 기능 | feature-builder + data-guardian + quality-gate (UI도 있으면 UI 스킬 추가) |
| 배포                  | release-guardian (변경 내용에 맞는 다른 스킬도 적용)                      |

스킬 본문: [design-guardian](.agents/skills/design-guardian/SKILL.md) · [feature-builder](.agents/skills/feature-builder/SKILL.md) · [data-guardian](.agents/skills/data-guardian/SKILL.md) · [quality-gate](.agents/skills/quality-gate/SKILL.md) · [accessibility-auditor](.agents/skills/accessibility-auditor/SKILL.md) · [release-guardian](.agents/skills/release-guardian/SKILL.md).

먼저 실제 코드와 사용 경로를 확인하고 **Analyze → Design → Implement → Validate → Review**를 수행한다. 작은 변경은 관련 검증만, 데이터 모델·인증·동기화는 강화된 검증을 수행한다. 스킬의 금지 사항과 완료 기준을 확인하고, 실행하지 못한 검증은 그대로 보고한다. 배포/DB 변경은 자동 승인하지 않는다.

Codex는 공식 규격에 따라 저장소의 `.agents/skills/`를 발견하고 설명과 작업이 맞으면 스킬을 선택할 수 있다. 명시 호출은 `$design-guardian`처럼 한다. **v0.app의 저장소 스킬 자동 발견·호출은 검증되지 않았다.** v0 작업에서는 이 파일과 위 표의 `SKILL.md`를 명시적으로 읽으라고 요청한다. 자동화 검사는 파일의 형식·경로만 검증하며 실제 에이전트의 호출을 보증하지 않는다.

## 정책·하네스 갱신 원칙

하네스에 적힌 내용이 이후 **사용자가 확정한 제품 정책** 또는 **검증된 실제 코드 동작**과 충돌하면, 기존 규칙을 무비판적으로 고수하지 않는다. 실제 충돌 근거를 확인하고 관련 기준 문서·스킬·테스트를 함께 수정한 다음 PR로 변경 이유와 영향 범위를 검토한다. 확정 사항과 제안/미확정 사항을 구분하며, 승인되지 않은 범위의 구현·운영 DB 변경·배포를 수반하지 않는다.
