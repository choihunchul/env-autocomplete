# ENV Autocomplete Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** .env 및 .env.example 파일 작성 시, AI/LLM 개발 환경 및 인프라/웹 개발에서 자주 사용하는 주요 환경 변수 키들을 설명 주석과 함께 완벽하게 자동 완성(Snippet)해주는 고품질 VS Code Extension 구축

**Architecture:** 
1. `src/dictionary.ts`: 사용자가 제공한 25개 이상의 고품질 환경 변수 템플릿(값, 설명, 그룹)을 격리 보관 및 제어.
2. `src/completion.ts`: 자동 완성의 핵심 비즈니스 로직(기본 변수와 설정 데이터 병합, 주석과 값 스니펫을 완성하는 조립 함수 등)을 포함하며 VS Code 모듈과 격리하여 Jest 유닛 테스트 수행.
3. `src/scanner.ts`: 워크스페이스 내 소스 코드 파일을 탐색해 `process.env.XXX` 형태의 키들을 동적 추출하는 독립 유틸리티 모듈.
4. `src/extension.ts`: VS Code 진입점으로서 API를 연동하고 `CompletionItemProvider` 등록.

**Tech Stack:** TypeScript, VS Code Extension API, Jest, ts-jest

---

### Task 1: 프로젝트 기초 환경 구축 및 빌드/테스트 세팅

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `src/extension.ts`

- [ ] **Step 1: package.json 생성**
  
  `package.json` 파일을 작업 루트에 생성합니다. VS Code Extension 활성화 이벤트 및 설정을 미리 정의합니다.
  
  ```json
  {
    "name": "env-autocomplete",
    "displayName": "ENV Autocomplete with Comments",
    "description": "Auto-completes common .env keys with descriptive comments and grouping.",
    "version": "1.0.0",
    "publisher": "myside",
    "engines": {
      "vscode": "^1.85.0"
    },
    "categories": [
      "Other"
    ],
    "activationEvents": [
      "onLanguage:properties",
      "onLanguage:dotenv"
    ],
    "main": "./out/extension.js",
    "contributes": {
      "languages": [
        {
          "id": "dotenv",
          "extensions": [
            ".env",
            ".env.example",
            ".env.local",
            ".env.development",
            ".env.production",
            ".env.test"
          ]
        }
      ],
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
    },
    "scripts": {
      "vscode:prepublish": "npm run compile",
      "compile": "tsc -p ./",
      "watch": "tsc -watch -p ./",
      "test": "jest"
    },
    "devDependencies": {
      "@types/jest": "^29.5.12",
      "@types/node": "^20.11.24",
      "@types/vscode": "^1.85.0",
      "jest": "^29.7.0",
      "ts-jest": "^29.1.2",
      "typescript": "^5.3.3"
    }
  }
  ```

- [ ] **Step 2: tsconfig.json 생성**
  
  TypeScript 컴파일러 설정을 생성합니다.
  
  ```json
  {
    "compilerOptions": {
      "module": "commonjs",
      "target": "ES2022",
      "outDir": "out",
      "lib": ["ES2022"],
      "sourceMap": true,
      "strict": true,
      "rootDir": "src",
      "esModuleInterop": true
    },
    "exclude": [
      "node_modules",
      ".vscode-test"
    ]
  }
  ```

- [ ] **Step 3: jest.config.js 생성**
  
  TypeScript 유닛 테스트 구동을 위한 Jest 설정을 작성합니다.
  
  ```javascript
  module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    verbose: true
  };
  ```

- [ ] **Step 4: 더미 src/extension.ts 생성**
  
  빌드가 깨지지 않도록 최소한의 익스텐션 구조만 잡아줍니다.
  
  ```typescript
  import * as vscode from 'vscode';

  export function activate(context: vscode.ExtensionContext) {
    console.log('ENV Autocomplete activated');
  }

  export function deactivate() {}
  ```

- [ ] **Step 5: 패키지 설치 및 빌드 확인**
  
  명령어: `npm install`
  명령어: `npm run compile`
  Expected: 빌드가 정상 완료되어 `out/extension.js` 파일이 생성됨.

---

### Task 2: 빌트인 사전 데이터 모듈 구현 및 TDD

**Files:**
- Create: `src/dictionary.ts`
- Create: `src/completion.ts`
- Create: `tests/completion.test.ts`

- [ ] **Step 1: Dictionary 데이터 모듈 생성**
  
  제공해주신 22종 변수 및 AI/LLM 필수 변수 10종이 포함된 사전 타입 및 맵을 구현합니다.
  
  ```typescript
  export interface EnvKeyInfo {
    value: string;
    description: string;
    group: string;
  }

  export const BUILT_IN_DICTIONARY: Record<string, EnvKeyInfo> = {
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
  };
  ```

- [ ] **Step 2: 핵심 비즈니스 로직 테스트 케이스 작성 (Failing Test)**
  
  `tests/completion.test.ts` 파일을 생성하여 키 사전을 병합하고 필터링하는 로직의 테스트 코드를 작성합니다.
  
  ```typescript
  import { mergeDictionaries, EnvKeyInfo } from '../src/completion';
  import { BUILT_IN_DICTIONARY } from '../src/dictionary';

  describe('Completion Logic - Dictionary Merge', () => {
    test('기본 사전과 사용자 지정 사전을 정상 병합해야 한다', () => {
      const customKeys: Record<string, EnvKeyInfo> = {
        "MY_CUSTOM": {
          "value": "123",
          "description": "커스텀 변수",
          "group": "Custom Group"
        }
      };

      const result = mergeDictionaries(true, customKeys);
      expect(result["NODE_ENV"]).toBeDefined();
      expect(result["MY_CUSTOM"]).toBeDefined();
      expect(result["MY_CUSTOM"].value).toBe("123");
    });

    test('enableBuiltInKeys가 false이면 기본 사전을 반환하지 않고 사용자 정의만 반환해야 한다', () => {
      const customKeys: Record<string, EnvKeyInfo> = {
        "MY_CUSTOM": {
          "value": "123",
          "description": "커스텀 변수",
          "group": "Custom Group"
        }
      };

      const result = mergeDictionaries(false, customKeys);
      expect(result["NODE_ENV"]).toBeUndefined();
      expect(result["MY_CUSTOM"]).toBeDefined();
    });
  });
  ```

- [ ] **Step 3: Run test to verify it fails**
  
  Run: `npm run test`
  Expected: FAIL (모듈과 함수가 정의되지 않아 에러 발생)

- [ ] **Step 4: `src/completion.ts` 최소 구현**
  
  테스트가 통과하도록 함수를 구현합니다.
  
  ```typescript
  import { EnvKeyInfo, BUILT_IN_DICTIONARY } from './dictionary';

  export { EnvKeyInfo };

  export function mergeDictionaries(
    enableBuiltIn: boolean,
    customKeys: Record<string, EnvKeyInfo>
  ): Record<string, EnvKeyInfo> {
    const merged: Record<string, EnvKeyInfo> = {};
    if (enableBuiltIn) {
      Object.assign(merged, BUILT_IN_DICTIONARY);
    }
    Object.assign(merged, customKeys);
    return merged;
  }
  ```

- [ ] **Step 5: Run test to verify it passes & Commit**
  
  Run: `npm run test`
  Expected: PASS
  Run: `git add . && git commit -m "feat: implement baseline dictionary merging with TDD"`

---

### Task 3: 주석 자동 생성 및 스니펫 빌더 구현 및 TDD

**Files:**
- Modify: `src/completion.ts`
- Modify: `tests/completion.test.ts`

- [ ] **Step 1: Snippet 조립 테스트 케이스 작성 (Failing Test)**
  
  스니펫 조립을 테스트하기 위해 `tests/completion.test.ts`에 테스트 케이스를 추가합니다.
  VS Code `SnippetString`과 유사한 문자열 구조 조립 방식을 검증하기 위해 순수 텍스트 결과 검증용 헬퍼 테스트를 수행합니다.
  
  ```typescript
  import { buildSnippetText } from '../src/completion';

  describe('Completion Logic - Snippet Builder', () => {
    test('주석과 플레이스홀더를 가진 스니펫 구조를 올바르게 문자열로 생성해야 한다', () => {
      const key = "GEMINI_API_KEY";
      const info = {
        value: "AIzaSyA1",
        description: "Google Gemini API 인증 키",
        group: "AI & LLM Integration"
      };

      const result = buildSnippetText(key, info);
      const expected = [
        "# [AI & LLM Integration] Google Gemini API 인증 키",
        "GEMINI_API_KEY=${1:AIzaSyA1}"
      ].join('\n');

      expect(result).toBe(expected);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  
  Run: `npm run test`
  Expected: FAIL (buildSnippetText 함수 누락)

- [ ] **Step 3: `src/completion.ts`에 Snippet 빌더 구현**
  
  ```typescript
  export function buildSnippetText(key: string, info: EnvKeyInfo): string {
    const commentLine = `# [${info.group}] ${info.description}`;
    const valueLine = `${key}=\${1:${info.value}}`;
    return `${commentLine}\n${valueLine}`;
  }
  ```

- [ ] **Step 4: Run test to verify it passes & Commit**
  
  Run: `npm run test`
  Expected: PASS
  Run: `git add . && git commit -m "feat: implement snippet generation utility with TDD"`

---

### Task 4: 프로젝트 소스 코드 스마트 스캔 로직 구현 및 TDD

**Files:**
- Create: `src/scanner.ts`
- Create: `tests/scanner.test.ts`

- [ ] **Step 1: Smart Scanner 테스트 케이스 작성 (Failing Test)**
  
  소스 코드가 담긴 가상의 파일 내용 스트림을 매개변수로 주어 `process.env.XXX` 키들을 올바르게 파싱해내는지 테스트합니다.
  
  ```typescript
  import { scanContentForEnvKeys } from '../src/scanner';

  describe('Smart Project Scanner', () => {
    test('소스코드 내용으로부터 process.env.키 형식을 정규식으로 감지해야 한다', () => {
      const content = `
        const apiKey = process.env.OPENAI_API_KEY;
        const port = process.env.PORT || 3000;
        console.log(process.env.DB_CONNECTION_STRING);
        // process.env.COMMENTED_OUT_KEY
      `;

      const keys = scanContentForEnvKeys(content);
      expect(keys).toContain("OPENAI_API_KEY");
      expect(keys).toContain("PORT");
      expect(keys).toContain("DB_CONNECTION_STRING");
      // 주석 단독이나 비매칭 패턴 체크
      expect(keys.size).toBe(3);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  
  Run: `npm run test`
  Expected: FAIL (scanContentForEnvKeys 없음)

- [ ] **Step 3: `src/scanner.ts` 구현**
  
  정규식 패턴 `/\bprocess\.env\.([A-Z_][A-Z0-9_]*)\b/g`를 사용하여 정교하게 파싱해내는 유틸리티 함수를 구현합니다.
  
  ```typescript
  export function scanContentForEnvKeys(content: string): Set<string> {
    const foundKeys = new Set<string>();
    const regex = /\bprocess\.env\.([A-Z_][A-Z0-9_]*)\b/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        foundKeys.add(match[1]);
      }
    }
    return foundKeys;
  }
  ```

- [ ] **Step 4: Run test to verify it passes & Commit**
  
  Run: `npm run test`
  Expected: PASS
  Run: `git add . && git commit -m "feat: implement static process.env analyzer with TDD"`

---

### Task 5: VS Code API 연동 및 통합 진입점 연결

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Extension 진입점에 Completion Provider 핵심 바인딩**
  
  `src/extension.ts` 파일을 수정하여 실제 VS Code 환경에서 자동 완성을 띄우는 메인 컨트롤러를 구현합니다.
  
  ```typescript
  import * as vscode from 'vscode';
  import { mergeDictionaries, buildSnippetText, EnvKeyInfo } from './completion';
  import { scanContentForEnvKeys } from './scanner';

  export function activate(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerCompletionItemProvider(
      { pattern: '**/.env*' },
      {
        async provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken,
          context: vscode.CompletionContext
        ) {
          // 1. 설정 불러오기
          const config = vscode.workspace.getConfiguration('envAutocomplete');
          const enableBuiltIn = config.get<boolean>('enableBuiltInKeys', true);
          const customKeys = config.get<Record<string, EnvKeyInfo>>('customKeys', {});
          const scanProject = config.get<boolean>('scanProjectForKeys', true);

          // 2. 기본/커스텀 사전 병합
          const merged = mergeDictionaries(enableBuiltIn, customKeys);

          // 3. 프로젝트 스마트 스캔 적용
          if (scanProject) {
            const files = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx,py,go}', '**/node_modules/**');
            for (const file of files) {
              try {
                const fileDoc = await vscode.workspace.openTextDocument(file);
                const content = fileDoc.getText();
                const scannedKeys = scanContentForEnvKeys(content);
                scannedKeys.forEach(key => {
                  if (!merged[key]) {
                    merged[key] = {
                      value: "your_value_here",
                      description: "프로젝트 소스 코드 스캔을 통해 감지된 환경 변수입니다.",
                      group: "Scanned From Source"
                    };
                  }
                });
              } catch (e) {
                // 파일 읽기 예외 조용히 처리
              }
            }
          }

          // 4. CompletionItem 리스트 조립
          const completionItems: vscode.CompletionItem[] = [];

          for (const [key, info] of Object.entries(merged)) {
            // 키를 제안 목록 라벨로 등록
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
            
            // 팝업 상세/문서 구조 기입
            item.detail = `[${info.group}]`;
            item.documentation = new vscode.MarkdownString(
              `**설명:** ${info.description}\n\n**기본값:** \`${info.value}\``
            );

            // Snippet 방식 완성 주입
            const snippet = new vscode.SnippetString();
            snippet.appendText(`# [${info.group}] ${info.description}\n`);
            snippet.appendText(`${key}=`);
            snippet.appendPlaceholder(info.value);

            item.insertText = snippet;
            completionItems.push(item);
          }

          return completionItems;
        }
      }
    );

    context.subscriptions.push(provider);
  }

  export function deactivate() {}
  ```

- [ ] **Step 2: 최종 컴파일 검증 및 빌드 확인**
  
  Run: `npm run compile`
  Expected: 에러 없이 정상적으로 빌드 성공하며 `out/` 폴더에 결과가 저장됨.
  Run: `git add . && git commit -m "feat: integrate core business logic with VS Code Extension API"`

---

## Verification Plan

### Automated Tests
*   `npm run test` 실행을 통해 병합 논리, 스니펫 텍스트 빌더, 소스 코드 정규식 분석 모듈 등이 100% 정상 작동하는지 Jest 유닛 테스트 검증.

### Manual Verification
1.  이 VS Code 프로젝트에서 `F5` 디버깅 모드를 구동하여 `[Extension Development Host]` 창 실행.
2.  가상의 테스트 파일 `.env` 및 `.env.example` 작성 시도.
3.  `GEMINI` 또는 `LANGSMITH` 등 특정 키워드 타이핑 시 제안 팝업이 활성화되는지 확인.
4.  키 선택 시 설명 주석과 함께 스니펫이 파일에 안전하게 개행 삽입되는지 및 값 영역 포커싱 작동 테스트.
5.  `settings.json` 설정에 `envAutocomplete.customKeys`를 임의 지정하고, 자동 완성 목록에 실시간 추가되어 팝업 주석이 다르게 나타나는지 확인.
