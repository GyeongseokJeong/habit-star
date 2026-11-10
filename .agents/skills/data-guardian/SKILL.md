---
name: data-guardian
description: 별하루 IndexedDB, 비회원 기록 이전, Supabase 스키마·RLS·RPC, 인증 및 오프라인 동기화 변경 시 사용자 기록 보존과 계정 격리를 검토한다. 저장 데이터 영향이 없는 작업에는 사용하지 않는다.
---

# data-guardian

## 호출 조건 및 제외 조건

데이터 모델·저장·인증·동기화·마이그레이션 영향이 있으면 호출한다. 저장 영향 없는 시각/문서 변경에는 제외한다.

## 참조 문서

`docs/ARCHITECTURE.md`, `docs/DEVELOPMENT_RULES.md`, `docs/operations.md`, `docs/implementation.md`.

## 실행 절차

원본→IndexedDB scopes/backup→Outbox→Supabase RPC/RLS→화면 소비자를 추적한다. v1 로컬 호환성과 비회원 원본 보존·명시적 가져오기 동의를 확인한다. 사용자별 격리, 오프라인 재시도·충돌 사본, 이전 버전 클라이언트를 검토한다. DB 변경은 신규 파일로 순차 마이그레이션하고 별도 테스트 DB에서 호환성·RLS·복구를 검증한다.

## 금지 사항

운영 DB reset/기존 마이그레이션 재실행, 직접 쓰기 권한 개방, 동의 없는 초기화·이전, Outbox/원본/충돌 자동 삭제 금지.

## 완료 기준

기존 기록과 미전송 변경이 보존되고 계정 격리·RPC 권한·재시도가 회귀 없이 작동한다.

## 실패 시 대응

쓰기·이전 적용을 멈추고 원본/작업 ID를 보존한다. `docs/operations.md`의 복구 순서를 따르며 누락 검증을 보고한다.

## 최종 결과 보고 형식

데이터 영향 / 호환성·격리 검사 / 백업·복구 조건 / 남은 위험.
