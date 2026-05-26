import { mergeDictionaries, EnvKeyInfo, buildSnippetText } from '../src/completion';
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

  test('사용자 정의 키가 기본 키와 충돌할 경우 사용자 정의 키가 빌트인 값을 오버라이딩해야 한다', () => {
    const customKeys: Record<string, EnvKeyInfo> = {
      "PORT": {
        "value": "8080",
        "description": "오버라이드된 포트",
        "group": "Custom Port Group"
      }
    };

    const result = mergeDictionaries(true, customKeys);
    expect(result["PORT"]).toBeDefined();
    expect(result["PORT"].value).toBe("8080");
    expect(result["PORT"].description).toBe("오버라이드된 포트");
    expect(result["PORT"].group).toBe("Custom Port Group");
  });

  test('사용자 정의 키가 비어 있고 enableBuiltIn이 true이면 정확히 BUILT_IN_DICTIONARY만 반환해야 한다', () => {
    const result = mergeDictionaries(true, {});
    expect(Object.keys(result).length).toBe(Object.keys(BUILT_IN_DICTIONARY).length);
    expect(result["NODE_ENV"]).toBeDefined();
  });

  test('사용자 정의 키가 비어 있고 enableBuiltIn이 false이면 빈 객체를 반환해야 한다', () => {
    const result = mergeDictionaries(false, {});
    expect(Object.keys(result).length).toBe(0);
  });
});

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

