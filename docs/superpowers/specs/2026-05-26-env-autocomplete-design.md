# VS Code Env Autocomplete Extension Design

## 1. 개요 및 목적
개발자들이 프로젝트 환경을 세팅할 때 `.env` 혹은 `.env.example` 파일을 많이 생성하고 편집합니다. 이 과정에서 자주 쓰이는 환경 변수(예: AI API 키, 데이터베이스 주소, OAuth 자격 증명 등)와 그에 대한 상세 주석 및 기본 형식 정보를 VS Code에서 손쉽게 입력할 수 있도록 **자동 완성(Auto-Completion)** 익스텐션을 개발합니다.

단순한 텍스트 완성을 넘어, **변수의 쓰임새를 명시하는 고품질의 설명 주석이 줄 위에 함께 자동 완성**되며, 관련된 변수들이 논리적인 **그룹(Grouping)** 단위로 묶여 관리되도록 하여 프로젝트의 가독성과 표준화 품질을 극대화합니다.

---

## 2. 핵심 기능 요구사항

### 2.1. 주석 자동 주입 및 스니펫(Snippet) 완성
사용자가 특정 환경 변수를 자동 완성(Enter 또는 Tab)하면, 해당 키의 설명이 주석 기호(`#`)와 그룹 카테고리를 포함하여 위에 자동 주입되고, 아래 줄에 키와 플레이스홀더 값이 스니펫 형태로 함께 기입됩니다.

*   **동작 예시 (GOOGLE_CLIENT_ID 선택 시)**:
    ```env
    # [Security & Authentication] OAuth 2.0 프로토콜 기반의 구글 소셜 로그인 및 사용자 프로필 연동 서비스를 개시하기 위한 애플리케이션 고유의 공개 클라이언트 식별자
    GOOGLE_CLIENT_ID=your_google_client_id
    ```
    *   완성 후 커서는 바로 `your_google_client_id`를 가리키고 영역 블록 지정이 되어, 사용자가 타이핑하는 즉시 값을 수정할 수 있습니다. (VS Code `SnippetString` 활용)

### 2.2. 익스텐션 설정 지원 (`settings.json`)
사용자가 VS Code의 UI 설정 창이나 `settings.json`을 통해 동작을 자유롭게 제어할 수 있도록 세 가지 설정을 제공합니다.

1.  `envAutocomplete.enableBuiltInKeys` (기본값: `true`)
    *   익스텐션이 자체 제공하는 고품질 빌트인 사전(Built-in Dictionary) 키 제안 활성화 여부.
2.  `envAutocomplete.customKeys` (기본값: `{}`)
    *   사용자가 직접 나만의 환경 변수 목록과 값, 설명, 그룹을 지정할 수 있는 사용자 지정 맵.
    *   **설정 예시**:
        ```json
        "envAutocomplete.customKeys": {
          "MY_PRIVATE_SERVICE_URL": {
            "value": "https://api.mycompany.internal",
            "description": "사내 내부망 연동을 위한 전용 프라이빗 서비스 베이스 경로",
            "group": "Internal APIs"
          }
        }
        ```
3.  `envAutocomplete.scanProjectForKeys` (기본값: `true`)
    *   작업 영역(Workspace) 내의 소스 코드 파일(예: `.js`, `.ts`, `.py` 등)을 비동기로 스캔하여 `process.env.XXXX` 혹은 `os.environ.get("XXXX")` 형태로 작성된 키들을 찾아 자동 완성 추천 목록에 **"프로젝트 소스 감지"** 설명과 함께 동적으로 추가해주는 스마트 기능.

---

## 3. 통합 빌트인 사전 데이터 명세 (Built-in Dictionary)
사용자님이 제공해주신 고품질 스펙 데이터와 추가로 요청해주신 AI/LLM, Auth, Cache 관련 누락 키들을 완벽하게 통합한 마스터 사전 명세입니다.

```json
{
  "NODE_ENV": {
    "value": "production",
    "description": "애플리케이션의 현재 런타임 가동 환경(development, production, test)을 선언하여 내부 컴파일러의 경고 수준 제어 및 코드 최적화 규칙을 트리거하는 최상위 변수",
    "group": "Application Environment"
  },
  "PORT": {
    "value": "3000",
    "description": "웹 애플리케이션 서버가 로컬 리스닝 소켓을 개방하여 호스트나 컨테이너 네트워크 트래픽을 처리하기 위해 바인딩하는 포트 정보",
    "group": "Application Environment"
  },
  "DEBUG": {
    "value": "false",
    "description": "치명적인 보안 취약 요소인 에러 스택 데이터의 브라우저 노출 수준 및 프레임워크 상세 로그 표출 범위를 일괄 조절하기 위한 불리언 스위치",
    "group": "Application Environment"
  },
  "APP_VERSION": {
    "value": "1.0.0",
    "description": "빌드 또는 실행 시점에 소스 제어 관리 및 패키징 빌드 버전과의 일관성을 대조하고 오류 추적 스택에 기입하기 위한 애플리케이션 공식 릴리즈 명세 버전",
    "group": "Application Environment"
  },
  "LOG_LEVEL": {
    "value": "info",
    "description": "표준 로그 수집기 모듈에서 스트림으로 분출할 상세 수준(debug, info, warn, error, fatal)의 수위를 결정하여 파일 I/O 및 메모리 점유율을 최적화하기 위한 환경 레벨 제어 변수",
    "group": "Application Environment"
  },
  "DJANGO_SETTINGS_MODULE": {
    "value": "mysite.settings.production",
    "description": "파이썬 Django 엔진 구동 단계에서 동적으로 식별하여 바인딩 처리할 타겟 구성 환경 모듈의 상대 경로 정보",
    "group": "Application Environment"
  },
  "DATABASE_URL": {
    "value": "postgresql://prod_user:secure_pass_123@localhost:5432/production_db",
    "description": "연동 대상인 주 저장소(RDBMS)의 엔진 속성, 접근 자격 증명, 엔드포인트 도메인, 기본 카탈로그 데이터베이스명을 일축한 통합 런타임 연결 정보",
    "group": "Database & Cache"
  },
  "DATABASE_POOL_SIZE": {
    "value": "10",
    "description": "서버 가동 시점에 사전에 가용 자원을 예약 확보하여 커넥션 병목 현상을 방지하고 고성능 트랜잭션을 수용하기 위해 설정하는 데이터베이스 풀(Pool)의 최대 개수 제한",
    "group": "Database & Cache"
  },
  "REDIS_URL": {
    "value": "redis://:redis_password_999@127.0.0.1:6379/0",
    "description": "실시간 데이터 임시 보관, 사용자 세션 클러스터링, 분산 락 구현 프로세스를 보장하기 위한 고성능 인메모리 저장소 접속 경로",
    "group": "Database & Cache"
  },
  "REDIS_PASSWORD": {
    "value": "redis_secure_pass_777",
    "description": "인메모리 캐시 및 세션 저장소인 Redis 서버로의 로컬/원격 소켓 연결 요청 시 비인가 사용자의 무단 데이터 탈취를 차단하기 위한 접속 비밀번호",
    "group": "Database & Cache"
  },
  "MEMCACHED_URL": {
    "value": "localhost:11211",
    "description": "애플리케이션 계층의 데이터베이스 쿼리 결과 및 API 응답의 고속 임시 저장 처리를 위한 고성능 분산 메모리 오브젝트 캐싱 시스템(Memcached) 접속 주소",
    "group": "Database & Cache"
  },
  "CACHE_TTL": {
    "value": "3600",
    "description": "메모리 또는 스토리지 상의 캐시 데이터가 유효한 최대 한계 런타임 수명(Time To Live)을 정의하는 초(second) 단위의 정수 설정값",
    "group": "Database & Cache"
  },
  "SECRET_KEY": {
    "value": "django-insecure-32_character_random_string_here",
    "description": "프레임워크가 가동되는 기본 세션 식별자의 암호학적 위변조 서명 서명과 보안 솔트 적용을 위해 고도의 보안성이 강제되는 핵심 마스터 대칭 키",
    "group": "Security & Authentication"
  },
  "JWT_SECRET": {
    "value": "super-secret-random-token-signing-key-32-bytes",
    "description": "서버 무상태 아키텍처 환경에서 전송되는 사용자 인증 데이터(JWT)의 기밀 서명 발행 및 진위 확인용 보안 시크릿 키",
    "group": "Security & Authentication"
  },
  "GOOGLE_CLIENT_ID": {
    "value": "1234567890-example.apps.googleusercontent.com",
    "description": "OAuth 2.0 프로토콜 기반의 구글 소셜 로그인 및 사용자 프로필 연동 서비스를 개시하기 위한 애플리케이션 고유의 공개 클라이언트 식별자",
    "group": "Security & Authentication"
  },
  "GOOGLE_CLIENT_SECRET": {
    "value": "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ere",
    "description": "구글 OAuth 로그인 흐름에서 사용자 임시 인가 코드를 검증하고 최종 엑세스 토큰으로 상호 교환하기 위해 백엔드 장치에서 비밀리에 지키는 크레덴셜 대칭 키",
    "group": "Security & Authentication"
  },
  "AWS_ACCESS_KEY_ID": {
    "value": "AKIAIOSFODNN7EXAMPLE",
    "description": "AWS 퍼블릭 클라우드 인프라 자원을 프로그래밍 인터페이스 방식으로 다루기 위해 요구되는 IAM 사용자 계정 고유의 고정 공개 토큰",
    "group": "Cloud Provider API"
  },
  "AWS_SECRET_ACCESS_KEY": {
    "value": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "description": "AWS 리소스 서비스 조작 승인을 완료받기 위해 보안 통신 서명 처리에 사용하는 최고 수준의 프라이빗 인프라 기밀 자격 증명 키",
    "group": "Cloud Provider API"
  },
  "GOOGLE_APPLICATION_CREDENTIALS": {
    "value": "/etc/secrets/gcp-service-account.json",
    "description": "Google Cloud Platform(GCP) 상의 인프라 제어 권한을 보장받기 위해 컨테이너 내부 가상 시스템 공간에 위치시킨 서비스 계정 JSON 기밀 키 파일의 실제 논리 경로",
    "group": "Cloud Provider API"
  },
  "GOOGLE_API_KEY": {
    "value": "AIzaSyA1_example_google_maps_api_key_value",
    "description": "구글 지도, 장소 검색 등 특정 Google Cloud 라이브러리를 통해 요청 트래픽 사용량을 연계 정산받기 위한 퍼블릭 API 승인 고유 식별값",
    "group": "Cloud Provider API"
  },
  "AZURE_CLIENT_ID": {
    "value": "00000000-0000-0000-0000-000000000000",
    "description": "Azure Active Directory(AD) 애플리케이션 통합 등록 시 생성되는 고유의 서비스 주체 식별 ID",
    "group": "Cloud Provider API"
  },
  "AZURE_CLIENT_SECRET": {
    "value": "azure_client_secret_value_here",
    "description": "Azure 리소스 권한 제어 토큰을 획득하는 과정에서 신원을 보증하기 위해 사용하는 보완 암호 정보",
    "group": "Cloud Provider API"
  },
  "FIREBASE_TOKEN": {
    "value": "1//0example_firebase_auth_token_value",
    "description": "Firebase 호스팅 서비스 배포 및 내부 백엔드 자원을 자동 빌드 단에서 직접 조작할 수 있도록 권한을 보장하는 특수 엑세스 토큰",
    "group": "Cloud Provider API"
  },
  "OPENAI_API_KEY": {
    "value": "sk-proj-example_openai_api_key_value",
    "description": "OpenAI의 GPT API 서비스 및 임베딩 모델 호출을 정상 인가받기 위해 사용하며, 클라이언트에 노출될 경우 심각한 비용 청구를 야기하는 시크릿 API 크레덴셜 키",
    "group": "AI & LLM Integration"
  },
  "GEMINI_API_KEY": {
    "value": "AIzaSyA1_example_gemini_api_key_value",
    "description": "Google Cloud 환경에서 운영되는 Gemini 텍스트 및 멀티모달 모델 API를 안전하게 트리거하고 트래픽 사용량을 연계 정산받기 위한 서비스 보안 키",
    "group": "AI & LLM Integration"
  },
  "CLAUDE_API_KEY": {
    "value": "sk-ant-api03_example_claude_api_key_value",
    "description": "Anthropic의 Claude 초대형 언어 모델 및 어시스턴트 API를 호출하여 애플리케이션 내의 추론과 대화형 태스크를 처리하기 위한 고유 인증 크레덴셜 키",
    "group": "AI & LLM Integration"
  },
  "ANTHROPIC_API_KEY": {
    "value": "sk-ant-api03_example_anthropic_api_key_value",
    "description": "Anthropic 클라이언트 라이브러리에서 기본적으로 인식하여 로드하는 Claude 모델 연동용 핵심 환경 변수 API 키",
    "group": "AI & LLM Integration"
  },
  "LANGCHAIN_API_KEY": {
    "value": "lsv2_pt_example_langchain_api_key_value",
    "description": "LangChain 에이전트 및 컴포넌트 구동의 오케스트레이션과 허브 자원 공유를 위해 사용되는 보안 통합 인증 키",
    "group": "AI & LLM Integration"
  },
  "LANGCHAIN_TRACING_V2": {
    "value": "true",
    "description": "LangChain 실행 과정을 LangSmith 콘솔 또는 로컬 디버깅 수집 도구로 전송하여 프롬프트 추적 및 실행 경로 분석을 강제할지 여부를 제어하는 스위치",
    "group": "AI & LLM Integration"
  },
  "LANGSMITH_TRACING": {
    "value": "true",
    "description": "LangSmith 프레임워크 수준에서 대화형 에이전트 및 LLM 체인 모듈의 실시간 레이턴시, 성능, 예외 이력을 수집 장치로 실시간 모니터링하기 위한 추적 활성화 변수",
    "group": "AI & LLM Integration"
  },
  "LANGSMITH_PROJECT": {
    "value": "my-llm-project",
    "description": "LangSmith 서비스 대시보드 상에서 수집되는 트레이싱 데이터를 고유하게 식별 및 격리 관리하기 위해 바인딩하는 타겟 프로젝트 레이블명",
    "group": "AI & LLM Integration"
  },
  "LANGSMITH_API_KEY": {
    "value": "lsv2_pt_example_langsmith_api_key_value",
    "description": "LangSmith 클라우드 서비스에 디버깅 및 트레이싱 수집 데이터 패킷을 실시간 전송 인가받기 위해 사용하는 마스터 서비스 접근 토큰",
    "group": "AI & LLM Integration"
  },
  "LANGSMITH_ENDPOINT": {
    "value": "https://api.smith.langchain.com",
    "description": "LangSmith 트레이싱 및 디버깅 데이터의 수집 처리를 담당하는 공식 클라우드 또는 온프레미스 API 수집 엔드포인트 URL 주소",
    "group": "AI & LLM Integration"
  },
  "STRIPE_API_KEY": {
    "value": "sk_live_51Nx...example",
    "description": "상용 글로벌 간편 결제 인터페이스인 Stripe와의 실시간 트랜잭션을 실행하기 위해 사용하며, 클라이언트에 절대 노출되어서는 안 되는 전용 시크릿 API 자격 증명 키",
    "group": "Third-Party Integration"
  },
  "TWILIO_ACCOUNT_SID": {
    "value": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "description": "통합 통신 서비스(SMS, 가상 발신 전화) 연동을 정상 호출하기 위해 요구되는 Twilio 마스터 계정의 고유 보안 식별 번호",
    "group": "Third-Party Integration"
  },
  "TWILIO_AUTH_TOKEN": {
    "value": "twilio_auth_token_secret_value_here",
    "description": "Twilio API 서비스를 실시간 트리거하기 위해 SID 정보와 결합하여 검증 단계를 통과해야 하는 고유 시크릿 토큰 키",
    "group": "Third-Party Integration"
  },
  "GITHUB_TOKEN": {
    "value": "ghp_secureGithubTokenValueHere12345",
    "description": "GitHub 소스 저장소에 프로그램 코드로 안전한 쓰기/읽기 동작을 수행하고 내부 REST API 도구를 제어하기 위해 발급받는 인가 권한 비밀 토큰",
    "group": "CI/CD & Hosting Platforms"
  },
  "NEXT_PUBLIC_API_URL": {
    "value": "https://api.production.example.com",
    "description": "클라이언트 브라우저 자바스크립트 번들에 하드코딩 방식으로 완전히 치환 반영하여, 실제 사용자의 비동기 통신 요청을 수용하는 공개 게이트웨이 엔드포인트 주소",
    "group": "Framework & Build Configuration"
  },
  "NEXT_PUBLIC_ANALYTICS_ID": {
    "value": "G-GA123456",
    "description": "클라이언트 방문자의 실제 활동 트래픽 데이터를 구글 애널리틱스 등 마케팅 수집 모듈로 전송하기 위해 브라우저 단에 완전 표출되어 작동하는 마케팅 도메인용 고유 식별 코드",
    "group": "Framework & Build Configuration"
  }
}
```

---

## 4. 구현 및 아키텍처 명세

1.  **언어 및 기술 스택**: TypeScript + VS Code Extension API (`vscode`)
2.  **활성화 감지 (`package.json`)**:
    ```json
    "activationEvents": [
      "onLanguage:properties",
      "onLanguage:dotenv"
    ],
    "contributes": {
      "languages": [{
        "id": "dotenv",
        "extensions": [".env", ".env.example", ".env.local", ".env.development", ".env.production", ".env.test"]
      }],
      "configuration": {
        "title": "Env Autocomplete",
        "properties": {
          "envAutocomplete.enableBuiltInKeys": {
            "type": "boolean",
            "default": true,
            "description": "내장된 고품질 환경 변수 사전을 기반으로 자동 완성을 추천합니다."
          },
          "envAutocomplete.customKeys": {
            "type": "object",
            "default": {},
            "description": "사용자 지정을 위해 직접 환경 변수를 등록합니다. 객체 구조(value, description, group)를 따릅니다."
          },
          "envAutocomplete.scanProjectForKeys": {
            "type": "boolean",
            "default": true,
            "description": "작업 영역의 프로젝트 코드 소스를 스캔하여 동적으로 환경 변수 키를 감지하고 추천 목록에 추가합니다."
          }
        }
      }
    }
    ```
3.  **Completion Logic 구현체 (`src/extension.ts`)**:
    *   `vscode.languages.registerCompletionItemProvider`를 사용하여 `dotenv` 또는 파일 확장자가 `.env`로 매칭되는 문서 객체에 트리거 등록.
    *   사용자의 입력이 이루어질 때 트리거하며, 완성 아이템으로 각 키를 변환.
    *   `vscode.SnippetString`을 적용하여 아래처럼 완성되도록 구성:
        ```typescript
        const snippet = new vscode.SnippetString();
        snippet.appendText(`# [${group}] ${description}\n`);
        snippet.appendText(`${key}=`);
        snippet.appendPlaceholder(defaultValue);
        ```
    *   자동 완성 목록에서 키 이름 뿐만 아니라 우측 설명 팝업(Detail & Documentation)도 풍부하게 노출되도록 `CompletionItem.detail`에 `[${group}]`을 표기하고, `CompletionItem.documentation`에 마크다운 설명 기재.
