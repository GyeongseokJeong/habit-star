---
name: quality-gate
description: 별하루 기능·데이터·인증·동기화 변경의 타입, 단위, PostgreSQL 보안, Playwright 회귀 및 GitHub Actions 품질을 검증한다. 단순 설명 요청에는 사용하지 않는다.
---

# quality-gate

## 호출 조건 및 제외 조건

기능·데이터 변경과 CI 실패 조사 시 호출한다. 실행 없는 단순 설명에는 제외한다.

## 참조 문서

`docs/DEVELOPMENT_RULES.md`, `docs/ARCHITECTURE.md`.

## 실행 절차

변경 경로를 분류하고 `pnpm validate:skills`(스킬 변경 시), `pnpm typecheck`, `pnpm test`부터 시작한다. 데이터는 `pnpm test:db --postgres`, 브라우저는 `pnpm test:e2e`, 빌드/운영 화면은 `pnpm build`, `pnpm test:e2e:production`을 적용한다. 인증·동기화는 로컬 Supabase에서 `pnpm test:db`와 `pnpm test:e2e:cloud`를 확인한다. GitHub CI의 SHA·verify/cloud 결과를 비교한다.

## 금지 사항

실패 테스트 삭제·무단 스킵, 미실행 결과를 통과라고 기재, 운영 DB를 테스트에 사용 금지.

## 완료 기준

관련 검사 통과, 불가능한 환경 조건·미실행 검사와 CI 상태 분리 보고.

## 실패 시 대응

첫 실패 단계·원인·기존 기준선을 확인하고 좁은 재현과 최소 수정 후 해당 검사 재실행.

## 최종 결과 보고 형식

실행 명령과 결과 / CI SHA·상태 / 미실행 사유 / 후속 조치.
