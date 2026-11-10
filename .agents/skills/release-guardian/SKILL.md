---
name: release-guardian
description: 별하루 배포/출시/Publish 준비 시 변경 파일, GitHub CI, 사용자 데이터, 인증, 환경변수, PWA 캐시와 롤백 위험을 점검한다. 일반 개발 중 실제 배포를 자동으로 실행하지 않는다.
---

# release-guardian

## 호출 조건 및 제외 조건

배포·릴리스 판단 때 호출한다. 일반 코드 수정만 하고 배포하지 않으면 제외한다.

## 참조 문서

`docs/DEVELOPMENT_RULES.md`, `docs/operations.md`, `docs/ARCHITECTURE.md`.

## 실행 절차

변경 파일과 데이터 영향, CI SHA와 verify/cloud 상태, `pnpm build`·프로덕션 브라우저 테스트를 확인한다. 인증/RLS·환경변수 노출·기존 PWA 앱 셸 캐시/오프라인 재진입과 순차 DB 적용을 검토한다. 백업·복구·중단 기준 및 기존 v0.app Publish 준비 상태를 기록한다.

## 금지 사항

CI 실패 숨김, 운영 환경변수 변경·DB 마이그레이션 실행·Publish를 승인 없이 수행, v1로 직접 롤백 금지.

## 완료 기준

배포 가능/보류 판단과 미검증 위험·복구 수단이 명확하다.

## 실패 시 대응

배포를 보류하고 실패 SHA/단계 및 사용자 데이터 위험을 기록한다. 원인 수정 후 CI와 복구 계획을 재확인한다.

## 최종 결과 보고 형식

변경 범위 / CI·빌드 결과 / 데이터·PWA 위험 / 배포 판단과 후속 조치.
