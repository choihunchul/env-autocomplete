# .env / .env.example 동기화 및 키 비교 기능 설계서

이 문서는 `.env` 파일과 `.env.example` 파일 간에 누락된 키를 상호 동기화하고, 실제 값의 노이즈 없이 오직 키(Key) 기준으로만 차이점을 비교할 수 있도록 하는 VS Code 확장 기능 설계서입니다.

## 1. 개요 및 요구사항
- **목적**: 개발 중 새로운 환경 변수가 추가될 때 `.env`와 `.env.example`이 불일치하는 문제를 쉽고 안전하게 해결합니다.
- **요구사항**:
  - `.env`에서 `.env.example`을 생성 및 동기화하는 메뉴 제공 (실제 값은 노출하지 않고 주석은 유지).
  - `.env.example`에서 `.env`를 생성 및 동기화하는 메뉴 제공 (기존 `.env` 값은 보존).
  - 이미 대상 파일이 존재한다면 덮어쓰지 않고 누락된 키만 건너뛰어 추가/동기화 처리.
  - 두 파일 간에 실제 값(Secrets)의 차이로 인한 노이즈를 없애기 위해 **값은 비교하지 않고 오직 키만 비교**하여 시각적인 Diff 제공.
  - 파일 탐색기 우클릭 메뉴 및 에디터 우측 상단 타이틀 바 메뉴를 통한 접근성 확보.

## 2. 주요 기능 상세

### A. `.env` -> `.env.example` 작성 및 동기화 (`envAutocomplete.createOrSyncExample`)
- **대상 파일**: `.env` 파일 활성화 상태 혹은 우클릭
- **동작**:
  1. `.env` 파일을 줄 단위로 파싱하여 키, 값, 주석을 추출합니다.
  2. `.env.example` 파일이 없다면 새 파일 생성. 이미 존재한다면 파일 내용을 분석합니다.
  3. `.env`에는 존재하지만 `.env.example`에는 없는 키를 식별합니다.
  4. 누락된 키에 대해 주석과 함께 `.env.example`에 추가합니다.
  5. **값 처리 규칙**:
     - 실제 값은 비워둡니다 (`KEY=`).
     - 단, 사전에 등록된 기본값(내장 사전 또는 `envAutocomplete.customKeys` 설정)이 존재하는 경우, 해당 기본값을 플레이스홀더 값으로 할당합니다 (예: `PORT=3000`).
     - 이 과정을 통해 개발자용 설정 정보나 구조는 유지하면서 민감한 자격 증명 정보의 유출을 방지합니다.

### B. `.env.example` -> `.env` 작성 및 동기화 (`envAutocomplete.createOrSyncEnv`)
- **대상 파일**: `.env.example` 파일 활성화 상태 혹은 우클릭
- **동작**:
  1. `.env.example` 파일을 파싱합니다.
  2. `.env` 파일이 없다면 새 파일 생성 (이때는 `.env.example` 파일의 값을 그대로 복사).
  3. `.env` 파일이 존재한다면, `.env.example`에는 존재하지만 `.env`에는 없는 키를 식별합니다.
  4. 누락된 키를 `.env` 파일 하단 혹은 알맞은 주석 뒤에 병합합니다.
  5. **값 보존 규칙**:
     - **이미 `.env`에 존재하는 기존 키의 값은 절대로 수정하거나 덮어쓰지 않고 보존**합니다.
     - 새로 추가되는 키는 `.env.example`에 정의된 기본값을 사용하거나 비워둡니다.

### C. 키 기준 비교 기능 (`envAutocomplete.compareKeys`)
- **동작**:
  1. VS Code의 가상 텍스트 문서 제공자(Virtual Document Provider)를 `env-key-diff` 스키마로 등록합니다.
  2. `env-key-diff://authority/env` 와 `env-key-diff://authority/example` 형태의 가상 URI를 생성합니다.
  3. 가상 문서 제공자는 실제 `.env` 및 `.env.example` 파일을 읽어 **값(Value) 부분을 전부 공백 처리**하여 반환합니다.
     - 예: `DB_PASSWORD=secret123` -> `DB_PASSWORD=`
     - 주석라인과 빈 줄은 그대로 유지하여 파일 구조를 비교할 수 있도록 합니다.
  4. `vscode.diff` 명령을 사용해 두 가상 문서를 Diff Editor로 실행합니다.
     - `vscode.commands.executeCommand('vscode.diff', envUri, exampleUri, '.env <-> .env.example (키 비교)')`
  5. 사용자는 실제 비밀번호 등이 달라서 발생하는 수많은 빨간/초록 줄 노이즈 없이, **누락된 키 또는 파일 구조의 차이점만 깔끔하게 시각적**으로 확인할 수 있습니다.

## 3. UI 및 메뉴 기여 (`package.json`)

### 메뉴 진입점
1. **탐색기 컨텍스트 메뉴 (`explorer/context`)**
   - 파일 탐색기에서 `.env` 또는 `.env.example`을 우클릭했을 때 나타납니다.
   - 조건: 파일명이 `.env`로 시작하거나 확장자가 `.env` 관련일 때 (`resourceFilename =~ /^\.env(\.|$)/`)
2. **에디터 타이틀 메뉴 (`editor/title`)**
   - `.env` 또는 `.env.example` 파일을 열었을 때 우측 상단 아이콘 영역에 표시됩니다.

### 커맨드 정의
- `envAutocomplete.createOrSyncExample` : `ENV: .env.example 작성/동기화`
- `envAutocomplete.createOrSyncEnv` : `ENV: .env 작성/동기화`
- `envAutocomplete.compareKeys` : `ENV: 키 비교 (Compare Keys)`

## 4. 예외 처리 및 검증 계획
- **파일 없음 예외**: 동기화 원본 파일이 존재하지 않는 경우 사용자에게 경고 메시지를 띄웁니다.
- **저장/수정 감지**: 파일 동기화 후 실제로 파일이 변경되었을 때만 디스크에 저장하여 무의미한 파일 수정을 방지합니다.
- **파싱 안정성**: 정규식을 통해 빈 줄이나 복잡한 주석 구조를 깨뜨리지 않도록 줄 단위 매칭을 수행합니다.
