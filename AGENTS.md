# 별하루 개발 헌장

모든 변경은 **Project Constitution → Agent Skills → Validation → GitHub CI** 순서로 검토한다. 제품 판단은 [제품 철학](docs/PRODUCT_PHILOSOPHY.md), 화면은 [디자인 시스템](docs/DESIGN_SYSTEM.md), 데이터 흐름은 [아키텍처](docs/ARCHITECTURE.md), 검증·배포는 [개발 규칙](docs/DEVELOPMENT_RULES.md)을 따른다. **V3.2 별자리 성장의 확정 정책·아트 합격 기준은 [시그니처 별자리 설계](docs/CONSTELLATION_V3_2.md)를 우선 확인한다.** 사용자 기록을 동의 없이 삭제·초기화·이전하지 않는다.

## 하네스 3.0 — 이해관계자 검토

제품/사용자 영향 작업은 [Stakeholder Harness](docs/STAKEHOLDER_HARNESS.md)의 route·modifier를 선택하고 관련 역할의 SKILL.md를 읽는다. 시안은 PM·UI·UX·사용자, 신규 기능 발굴은 6개 관점, 개별 기능은 PM·UX·사용자 및 영향에 맞는 전문가를 참여시킨다. 필요한 경우 BM·마케터를 추가한다. 기술 전용 변경은 불필요한 패널을 생략한다. `node scripts/select-stakeholders.mjs <route> [modifier ...]`는 추천 역할과 스킬을 출력하며 실제 호출을 자동 실행하지 않는다.

역할 스킬: [stakeholder-panel](.agents/skills/stakeholder-panel/SKILL.md) · [product-planner](.agents/skills/product-planner/SKILL.md) · [ui-specialist](.agents/skills/ui-specialist/SKILL.md) · [ux-specialist](.agents/skills/ux-specialist/SKILL.md) · [business-strategist](.agents/skills/business-strategist/SKILL.md) · [growth-marketer](.agents/skills/growth-marketer/SKILL.md) · [user-perspective](.agents/skills/user-perspective/SKILL.md).

시안/기능 발굴/신규 기능/BM/마케팅은 1차 독립 관점 검토 → 이견 조율·수정 → 2차 동일 기준 재평가를 기본으로 한다. 실제 서브에이전트가 없으면 동일 모델의 관점 검토라고 명시한다. 실제 사용자 조사·실기기 검증과 혼동하지 않는다. 승인 범위 내 변경만 실행하며, P0/P1 및 기존 보호 스킬 게이트는 평균 점수로 상쇄하지 않는다. 제품·시안 리뷰는 [검토 절차](docs/STAKEHOLDER_HARNESS.md)를 따르고 PR에는 참여 역할·결정·검증·잔여 위험을 남긴다.

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
