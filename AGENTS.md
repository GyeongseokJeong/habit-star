# 별하루 개발 헌장

모든 변경은 **Project Constitution → Agent Skills → Validation → GitHub CI** 순서로 검토한다. 제품 판단은 [제품 철학](docs/PRODUCT_PHILOSOPHY.md), 화면은 [디자인 시스템](docs/DESIGN_SYSTEM.md), 데이터 흐름은 [아키텍처](docs/ARCHITECTURE.md), 검증·배포는 [개발 규칙](docs/DEVELOPMENT_RULES.md)을 따른다. 사용자 기록을 동의 없이 삭제·초기화·이전하지 않는다.

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
