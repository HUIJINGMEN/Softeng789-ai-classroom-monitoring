# 이 노트북에서 Docker 없이 실행하기

이 안내는 `D:\UOA2\2026\Softeng789-ai-classroom-monitoring`에 준비한 **현재 노트북 전용 환경** 기준입니다. Docker나 Conda를 새로 설치할 필요가 없습니다. 실제 학생 데이터 없이 새 개발 DB와 초기 관리자 계정을 준비했습니다.

## 2026-10-21 원본 main 통합 시 주의

이 문서의 기존 시작 명령은 통합 전 환경 기준입니다. 현재 phase1 통합본은 Flyway와 쿠키 인증을 사용하므로 기존 DB의 백업·정렬·baseline 검토가 먼저 필요합니다. 이번 병합 검증은 별도 테스트 DB에서 수행했으며 사용자 DB를 업그레이드하지 않았습니다. `setup.py`나 전체 schema를 다시 적용하지 마세요. 의존성 설치를 위해 기존 프론트엔드 서버는 중지했습니다.

## 접속과 로그인

1. 서비스가 실행 중이면 브라우저에서 <http://localhost:5173>에 접속합니다.
2. **Sign in**을 누릅니다.
3. 이메일은 `admin@auckland.ac.nz`입니다.
4. 비밀번호는 `data/local-dev/LOGIN.local.txt` 파일의 `Password:` 뒤에 있습니다. 이 파일은 비밀값이므로 공유하지 마세요.
5. 로그인하면 **Admin Console**이 열립니다. 최초에는 빈 DB였으며, 이후 본인 얼굴 테스트용 학생·교사·수업·출석 세션을 추가했습니다. 실제 얼굴 데이터와 동의는 준비 작업에서 입력하지 않았습니다.

최초 실행 시 필요한 스키마는 이미 적용했습니다. 다시 실행할 때 DB를 초기화하거나 마이그레이션을 반복할 필요는 없습니다. `setup.py`는 최초 설치용이며 재실행하지 마세요.

## 시작하기

PowerShell에서 다음 두 줄을 실행합니다.

```powershell
cd D:\UOA2\2026\Softeng789-ai-classroom-monitoring
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\data\local-dev\start.ps1
```

DB, backend, frontend, Python을 백그라운드에서 시작합니다. 백엔드 준비에 약간의 시간이 걸리므로 처음에는 20~30초 정도 기다렸다가 접속하세요. 오류가 있으면 아래 로그를 확인합니다. `ExecutionPolicy Bypass`는 이 명령으로 시작한 PowerShell에만 적용하며, 컴퓨터 전체 정책을 변경하지 않습니다.

## 종료하기

```powershell
cd D:\UOA2\2026\Softeng789-ai-classroom-monitoring
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\data\local-dev\stop.ps1
```

이 실행 스크립트로 시작한 서비스와 전용 DB만 종료합니다. 데이터와 설정은 보존합니다. 프로세스 ID가 다른 프로그램에 재사용된 경우 명령줄을 확인하여 해당 프로그램을 종료하지 않습니다.

## 실행 구성

| 구성 | 주소 또는 위치 | 역할 |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | 사용자 화면 |
| Backend | `http://127.0.0.1:8080` | 로그인, 권한, 학생·출석 API |
| Python | `http://127.0.0.1:8000` | 얼굴 인식 서비스 |
| PostgreSQL | `127.0.0.1:55440`, DB `classroom_local` | 개발 데이터 저장 |
| Python 환경 | `ai-service/.venv` | 설치된 Python 패키지 |
| DB 파일 | `data/local-dev/postgres-data` | 이 앱 전용 데이터. 삭제하지 마세요. |
| 실행 설정 | `data/local-dev/settings.json` | DB 비밀번호, 서비스 키, 암호화 키 등 |
| 로그인 정보 | `data/local-dev/LOGIN.local.txt` | 최초 로컬 관리자 로그인 |

모든 서비스는 노트북 내부에서만 접속하도록 `127.0.0.1`에 바인딩했습니다. 휴대폰 등 다른 장치에서 접속하는 구성은 아닙니다. DB는 비밀번호 인증을 사용하고 기존 테스트 DB와 별도로 만들었습니다.

Spring과 Python의 환경 변수는 `run-service.ps1`이 `settings.json`에서 읽어 전달합니다. 이 실행 방식에서는 루트 `.env`를 만들거나 매번 환경 변수를 직접 입력할 필요가 없습니다. 관리자 활성화용 `BOOTSTRAP_ADMIN_PASSWORD`는 최초 생성 후 실행 설정에서 제거했습니다.

`data/`는 Git에서 제외됩니다. 로컬 DB, 비밀값, 시작·종료 스크립트도 커밋되지 않습니다. 다른 팀원의 컴퓨터에는 해당 환경이 없으므로 이 스크립트만 복사한다고 실행되지는 않습니다. 공통 설치 원리는 [한국어 구현 가이드](phase1-photo-attendance.ko.md)를 참고하세요.

## 준비된 얼굴 테스트 사용하기

현재 `CV_ENABLED`는 `true`이며, Python 서비스와 실제 YuNet/SFace 모델 로딩을 확인했습니다. 테스트용 학생·교사 계정은 `data/local-dev/FACE-TEST-LOGIN.local.txt`에 있습니다. 비밀번호는 문서나 Git에 포함하지 않습니다.

| 준비된 항목 | 값 |
| --- | --- |
| 학생 이메일 | `face.student@example.test` |
| 교사 이메일 | `face.teacher@example.test` |
| 학생 표시 이름 | `DoJun Face Test` |
| 수업 | `FACE TEST / Local Webcam Pilot` |
| 교실 | `LOCAL-WEBCAM` |

### 1. 학생 계정으로 직접 동의

1. <http://localhost:5173>에서 기존 관리자 계정을 **Sign out**한 뒤 학생 계정으로 로그인합니다.
2. 학생 홈의 **Optional photo attendance**를 찾습니다. 필요한 경우 아래로 스크롤합니다.
3. 고지문을 읽고 본인이 성인 및 자발적 참여 조건에 해당한다면 두 체크박스를 직접 선택합니다.
4. **Give optional consent**를 누릅니다. 준비 작업에서는 이 동의를 대신 제출하지 않았습니다.

### 2. 교사 계정으로 웹캠 등록

1. 학생 계정에서 로그아웃하고 교사 계정으로 로그인합니다. 일반 창과 시크릿 창을 각각 사용해 두 계정을 분리해도 됩니다.
2. <http://localhost:5173/?page=session-detail>에 접속합니다. 이 테스트 계정에는 하나의 출석 세션이 준비되어 있습니다. **FACE TEST** 세션인지 확인합니다.
3. **Photo attendance · teacher review** 영역에서 **Face enrollment and consent status**를 펼칩니다.
4. **Refresh consent status**를 누르고 `DoJun Face Test` 옆의 **Enroll face**를 누릅니다.
5. 카메라 권한을 허용합니다. 밝은 곳에서 한 사람만 보이게 하고, 안내에 따라 **Capture pose**를 일곱 번 누릅니다. 옆으로 돌릴 때도 두 눈이 보이도록 조금만 돌리세요.
6. 촬영 결과를 확인하고 교사 확인 체크박스와 **Check and save face enrollment**로 저장합니다. 다시 찍으려면 **Retake all**을 사용합니다.

혼자 두 역할을 사용하는 과정은 본인 얼굴로 로컬 기능을 확인하기 위한 것입니다. 실제 학생 등록에서는 담당 교사가 대면으로 신원을 확인해야 합니다.

### 3. 웹 카메라로 촬영하고 바로 인식 확인

1. 교사 계정에서 같은 출석 세션을 열고 **Open camera**를 누릅니다. 얼굴 등록 창이 열려 있다면 먼저 닫습니다.
2. 브라우저 카메라 권한을 허용하고 얼굴이 미리보기에 잘 보이도록 합니다. 기본은 노트북/전면 카메라이며, 휴대폰에서는 **Rear camera (if available)**로 후면 카메라를 요청할 수 있습니다.
3. 화면에 포함된 사람의 동의 확인란을 체크하고 **Capture and recognize**를 누릅니다. 사진 한 장이 즉시 업로드되어 인식됩니다. 촬영하거나 **Close camera**를 누르면 카메라가 꺼집니다.
4. 얼굴에 번호·테두리가 표시되는지, `DoJun Face Test`가 후보로 나오는지 확인합니다. 불확실하거나 후보가 없을 수도 있으므로 결과를 직접 확인하세요.
5. 인식 결과만 보고 끝내려면 저장하지 않아도 됩니다. 테스트 출석까지 저장하려면 얼굴별 학생을 선택하고 **I checked every face...**를 체크한 다음 **Confirm and save attendance**를 누릅니다.

사진 분석 자체는 반복할 수 있습니다. 이미 저장된 출석은 덮어쓰지 않으므로, 같은 세션에서 출석 저장을 다시 시도하면 충돌 안내가 나올 수 있습니다. 기존 출석 수정은 **Correct manually**를 사용합니다.

기존 JPEG/PNG 파일은 **Or take or choose a photo file**에서 선택한 뒤 동의를 확인하고 **Recognize faces**로 분석할 수 있습니다. 카메라 업로드가 실패하면 현재 사진에서 같은 버튼으로 재시도하거나 다시 촬영하세요. 휴대폰 카메라에는 HTTPS가 필요하며, 노트북의 `localhost` 주소를 휴대폰에 입력하면 노트북 서버에 연결되지 않습니다.

테스트 후 학생 계정의 **Withdraw consent and delete face templates**로 동의를 철회하고 템플릿을 삭제할 수 있습니다. 이미 저장된 테스트 출석은 별도로 남습니다.

### 다른 테스트 계정을 추가할 경우

실제 얼굴 등록을 하려면 다음 준비가 필요합니다.

1. Admin Console에서 교사 계정과 수업·교실을 준비합니다.
2. 학생 계정의 가입·승인·수강 등록을 완료합니다.
3. 참여자에 대한 필요한 기관 검토와 자발적 동의를 확인합니다.
4. `data/local-dev/settings.json`의 `CV_ENABLED`가 `true`인지 확인합니다. 설정을 변경했다면 서비스를 재시작합니다.
5. 학생이 포털에서 선택적 동의를 제출하고, 교사가 해당 수업의 출석 세션에서 얼굴 등록을 진행합니다.

얼굴 등록은 노트북 웹캠으로 할 수 있습니다. 교실 사진 인식은 JPEG/PNG 사진을 선택하는 방식입니다. 실시간 영상 추적은 이번 기능에 포함하지 않았습니다. `CV_ENCRYPTION_KEY`는 기존 얼굴 데이터를 읽는 데 필요하므로 임의로 교체하지 마세요.

## 오류가 있을 때

- 접속 불가: `start.ps1` 실행 여부를 확인하고, 아래 로그에서 오류를 확인합니다.
- 로그인 불가: 로그인 파일의 비밀번호를 복사했는지 확인합니다. 앞뒤 공백은 넣지 마세요.
- 포트 충돌: 스크립트는 다른 프로그램을 강제로 종료하지 않습니다. 5173·8080·8000·55440 포트 사용 프로그램을 확인해야 합니다.
- 재시작 후 로그인 화면으로 돌아감: 인증 세션은 서버 메모리에 있으므로 다시 로그인하면 됩니다. DB의 학생·출석 데이터는 유지됩니다.
- 웹 아이콘 `favicon.ico` 404: 기존 프로젝트에 아이콘 파일이 없는 현상으로, 로그인 및 API 동작에는 영향을 주지 않습니다.

로그 확인 예시:

```powershell
Get-Content .\data\local-dev\backend.stdout.log -Tail 40
Get-Content .\data\local-dev\backend.stderr.log -Tail 40
Get-Content .\data\local-dev\frontend.stderr.log -Tail 40
Get-Content .\data\local-dev\python.stderr.log -Tail 40
```

DB 로그는 `data/local-dev/postgres.log`입니다. 비밀번호가 있는 `settings.json`, `db-owner.local.json`, `LOGIN.local.txt`의 내용을 로그와 함께 공유하지 마세요.
