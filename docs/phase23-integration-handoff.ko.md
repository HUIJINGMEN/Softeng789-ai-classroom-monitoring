# Phase2·3 통합 결과와 화면 정리 인계

## 기준 상태

- 검증일: 2026-10-30 (Pacific/Auckland).
- 작업 브랜치: `DoJun/phase3d-local-eye-head-observations`.
- Phase3D 보존 커밋: `48dca96`.
- 병합 대상: Phase2 PR 정리의 `dd139e8`까지 전체 이력. 마지막 보안 수정만 cherry-pick한 것이 아닙니다.
- Phase3D는 현재 로컬 실험 범위에서 마무리했습니다. [한글 가이드](phase3d-local-eye-head.ko.md), [English guide](phase3d-local-eye-head.md).
- 이번 작업은 로컬 커밋과 통합 검증입니다. 원본 main 병합, GitHub push, PR 승인, 운영 배포는 수행하지 않았습니다. 원격 PR/SonarQube의 현재 통과 여부도 별도 확인이 필요합니다.

## 병합 처리

실제 충돌은 두 검증 스크립트에서 발생했습니다.

- `scripts/test-frontend-models.sh`: Phase3 카메라/공유/눈·고개 테스트와 Phase2 품질/포커스 테스트를 모두 유지했습니다.
- `scripts/test-postgres-schema.py`: Phase2의 정식 Flyway DDL 참조 확장과 과거 스키마 실행 차단 검증을 유지하고, Phase3의 V6 기준 업그레이드 검증 DB도 유지했습니다.

학생 모바일 화면과 의존성 파일은 자동 병합됐습니다. 버전이 지정된 Flyway 마이그레이션 파일은 이번 병합에서 변경되지 않았고, 로컬 사용자·얼굴·출석 데이터를 초기화하지 않았습니다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| Phase3D 커밋 전 프론트엔드 | 388개 통과, 타입 검사·빌드 통과 |
| 병합 후 프론트엔드 | 407개 통과, 구조 경계 검사·타입 검사·빌드 통과 |
| 백엔드 전체 | 633개 중 628개 통과, 조건부 5개 생략, 실패·오류 없음 |
| 실제 Python 연결 및 로그 보호 추가 검증 | `VisionGatewayTest` 4개와 `VisionGatewayLoggingTest` 6개 모두 통과. 전체 실행에서 생략됐던 실제 서비스 테스트도 여기서 통과 |
| Python 서비스 | 78개 중 77개 통과, Windows 심볼릭 링크 생성 권한으로 1개 생략 |
| Phase2 SQL 원본 참조 검사 | 2개 통과 |
| 브라우저 통합 스모크 | 학생·교사 로그인, 학생 사진 출석 화면, 교사 Live monitoring 진입, 실제 MediaPipe 워커 로딩, 로컬 실험 활성화, 공유 기본 꺼짐, 카메라 정지 후 초기화 확인 |
| 모바일 | 390px에서 출석 진입 유지 및 가로 넘침 없음 |
| 가입용 수업 API | `/api/classes/public` HTTP 200. 과거 500 오류 원인을 규명한 것은 아님 |

브라우저 검증은 가상 카메라로 진행했습니다. 얼굴이 없는 입력을 측정 불가로 처리하는 동작을 확인했으며, 실제 얼굴 정확도나 새 사진 출석 저장 전 과정을 이번에 다시 검증한 것은 아닙니다. 검증 중 브라우저 예외/API 5xx는 없었습니다. 실제 네트워크 간 영상 공유, 20명 동시 영상 부하는 검증하지 않았습니다.

### 완료되지 않은 환경별 검사

- 별도 일회용 PostgreSQL을 요구하는 4개 테스트는 이번 전체 실행에서 생략됐습니다. Docker 기반 새 DB/과거 DB 업그레이드 전체 시나리오는 재실행하지 않았습니다. 실제 로컬 PostgreSQL에서 앱 시작과 로그인을 확인한 것과 구분해야 합니다.
- `scripts/tests` 전체는 Windows에서 POSIX 전용 `os.O_DIRECTORY` 등과 심볼릭 링크 권한 때문에 20개 중 7개 오류가 발생했습니다. 설치된 WSL Ubuntu의 Python 3.8도 `zoneinfo` 등 요구 API가 없어 대체 실행을 완료하지 못했습니다.
- 모델 설치기의 심볼릭 링크 테스트도 WSL Python 3.8의 `Path.is_relative_to` 미지원으로 대체 검증하지 못했습니다. Linux/Python 3.12 CI에서 확인해야 하며, 통과시키기 위해 보안 검사를 제거하지 않았습니다.

## 유지할 기능과 경계

- Phase2: 얼굴 등록 또는 얼굴 없는 가입 → admin 승인, 학생 사진 출석 요청, 교사 사진 인식·검토·출석 저장, 수동 출석.
- Phase3: 카메라 한 개를 사용하며 관찰 이벤트 공유와 영상 공유는 각각 별도로 동의하고 켜거나 끕니다. 기본값은 꺼짐입니다.
- Phase3D: 눈 감김·고개 숙임 결과는 로컬 메모리에만 존재합니다. 새 결과를 교사에게 전송하거나 출석·집중도·졸음 점수로 변환하지 않습니다.
- 사용자 실제 테스트: 안경 미착용 시 눈 감김 작동, 안경 착용 시 눈 측정 불안정. 빛 반사는 추정 원인입니다. 고개 숙임은 작동하나 필기와 졸음을 구분하지 못합니다.
- 현재 영상은 최대 4명인 로컬 네트워크 파일럿입니다. 목록을 20명 규모로 정리하더라도 영상 동시 접속 한도를 자동으로 늘리지 않습니다.

## 다음 채팅의 화면 정리 범위

먼저 현재 Git 상태와 이 병합을 포함하는 HEAD를 확인한 뒤 `DoJun/phase2-3-ui-cleanup` 브랜치를 생성합니다. 다른 채팅이 작업 중이면 별도 worktree를 사용하고, 동일 파일을 동시에 수정하지 않습니다.

1. 학생 홈에는 오늘 수업·출석 상태·출석 체크·수업 카메라 진입을 중심으로 표시합니다. 얼굴 등록 관리는 프로필로 이동하고 등록 필요 시에만 안내합니다.
2. 카메라 화면은 미리보기·시작/종료·두 공유 스위치·현재 상태를 중심으로 정리합니다. 자세한 안내·기록·수치·실험 기능은 필요할 때 펼치도록 합니다. 핵심 동의와 공유 여부는 숨기지 않습니다.
3. 교사 화면은 학생별 간결한 목록, 검색/필터, 선택 시 상세 영상·관찰 확인으로 정리합니다. 출석 상태와 관찰 상태를 구분합니다. Phase3D의 로컬 데이터는 이 화면에 새로 연결하지 않습니다.
4. 데스크톱·모바일·키보드 조작, 출석 저장/승인 상태, 카메라 해제, 개별 공유 중지, 재시작 시 동의·설정 초기화 등 기존 동작을 회귀 검증합니다.

새 모델, 졸음 추론, 추가 관찰 알림, 영상 확장, 배포는 이 화면 정리 범위에 포함하지 않습니다. UI는 영어, 사용자 설명과 질문은 한국어로 합니다. 화면 정리 변경은 사용자가 확인한 뒤 커밋·push합니다.

### 새 채팅에 붙여 넣을 요청

```text
docs/phase23-integration-handoff.ko.md를 읽고 현재 Git 상태부터 확인해줘.
Phase2 dd139e8과 Phase3D를 통합한 브랜치를 기준으로
DoJun/phase2-3-ui-cleanup 브랜치를 만들어 화면 정리를 진행해줘.
학생 홈·출석 흐름, 카메라 화면, 교사 목록 순서로 단순하게 정리하고
기존 기능과 동의·공유·데이터 보관 경계를 유지해줘.
Phase3D 감지 알고리즘은 추가 개선하지 마.
구현 전 간단한 화면 구성안을 제시하고, 구현 후 관련 테스트와 모바일 확인을 해줘.
커밋과 push 전에는 내가 변경 사항을 확인하게 해줘.
```

## English summary for collaborators

Phase3D has been closed as a local-only experiment, with qualitative user feedback and limitations documented. Phase2 through `dd139e8` is integrated without removing Phase3 coverage. The next task is UI simplification, preserving separate consent/sharing controls and manual attendance. No sleep or attention inference is approved. Frontend tests/build, backend tests (with conditional exclusions), Python tests and browser entry/camera smoke checks passed as detailed above; Linux-specific tooling and disposable PostgreSQL CI checks remain outstanding. No GitHub push or deployment is part of this handoff.
