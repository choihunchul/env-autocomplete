import * as vscode from 'vscode';
import { EnvKeyInfo } from './completion';

/** WebView에서 extension으로 오는 메시지 타입 */
interface SubmitMessage {
  command: 'submit';
  key: string;
  description: string;
  group: string;
  defaultValue: string;
}

interface CancelMessage {
  command: 'cancel';
}

type WebViewMessage = SubmitMessage | CancelMessage;

/**
 * '사전에 추가' WebView 패널을 열고,
 * 사용자가 폼을 제출하면 envAutocomplete.customKeys에 저장한다.
 */
export async function openAddKeyPanel(
  context: vscode.ExtensionContext,
  key: string,
  onSaved: () => void
): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'envAddKey',
    `ENV 사전 등록 — ${key}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: false }
  );

  panel.webview.html = getWebviewContent(key);

  // WebView → Extension 메시지 처리
  panel.webview.onDidReceiveMessage(
    async (message: WebViewMessage) => {
      if (message.command === 'cancel') {
        panel.dispose();
        return;
      }

      if (message.command === 'submit') {
        const config     = vscode.workspace.getConfiguration('envAutocomplete');
        const customKeys = config.get<Record<string, EnvKeyInfo>>('customKeys', {});

        customKeys[message.key] = {
          value:       message.defaultValue || 'your_value_here',
          description: message.description,
          group:       message.group        || 'Custom',
        };

        await config.update(
          'customKeys',
          customKeys,
          vscode.ConfigurationTarget.Workspace
        );

        vscode.window.showInformationMessage(
          `✅ '${message.key}' 가 ENV Autocomplete 사전에 추가되었습니다!`
        );

        panel.dispose();
        onSaved();
      }
    },
    undefined,
    context.subscriptions
  );
}

// ─── WebView HTML ──────────────────────────────────────────────────────────
function getWebviewContent(key: string): string {
  // 미리 정의된 그룹 목록
  const groups = [
    'Application Environment',
    'Database',
    'Cache',
    'Authentication & Security',
    'Cloud Provider',
    'AI / LLM',
    'Payment',
    'Communication',
    'Frontend',
    'Custom',
  ];

  const groupOptions = groups
    .map(g => `<option value="${g}">${g}</option>`)
    .join('\n');

  return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ENV 사전 등록</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 28px 32px;
    }

    h1 {
      font-size: 1.15em;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--vscode-editor-foreground);
    }

    .subtitle {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 28px;
    }

    .key-badge {
      display: inline-block;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 4px;
      padding: 2px 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
      letter-spacing: 0.03em;
    }

    .field {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 0.82em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-foreground);
      margin-bottom: 6px;
    }

    label .required {
      color: var(--vscode-inputValidation-errorBorder);
      margin-left: 3px;
    }

    label .hint {
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      color: var(--vscode-descriptionForeground);
      margin-left: 6px;
    }

    input[type="text"],
    select,
    textarea {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #555);
      border-radius: 4px;
      padding: 7px 10px;
      font-family: inherit;
      font-size: 1em;
      outline: none;
      transition: border-color 0.15s;
    }

    input[type="text"]:focus,
    select:focus,
    textarea:focus {
      border-color: var(--vscode-focusBorder);
    }

    input.error,
    textarea.error {
      border-color: var(--vscode-inputValidation-errorBorder);
    }

    .error-msg {
      display: none;
      font-size: 0.8em;
      color: var(--vscode-inputValidation-errorBorder);
      margin-top: 4px;
    }

    .error-msg.visible { display: block; }

    textarea {
      resize: vertical;
      min-height: 72px;
    }

    input[readonly] {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--vscode-editorWidget-border, #333);
      margin: 8px 0 24px;
    }

    .actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 8px;
    }

    button {
      padding: 7px 20px;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.95em;
      cursor: pointer;
      transition: opacity 0.15s, background 0.15s;
    }

    button:hover { opacity: 0.85; }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3a3a);
      color: var(--vscode-button-secondaryForeground, #ccc);
    }
  </style>
</head>
<body>
  <h1>🔖 ENV 사전 등록</h1>
  <p class="subtitle">
    <span class="key-badge">${key}</span>
    &nbsp;키를 자동완성 사전에 추가합니다.
  </p>

  <hr class="divider" />

  <form id="form" novalidate>
    <!-- 키 이름 (읽기 전용) -->
    <div class="field">
      <label>키 이름</label>
      <input type="text" id="keyName" value="${key}" readonly />
    </div>

    <!-- 설명 -->
    <div class="field">
      <label>
        설명<span class="required">*</span>
        <span class="hint">자동완성 팝업에 표시됩니다</span>
      </label>
      <textarea
        id="description"
        placeholder="예: API 서버 엔드포인트 URL"
        autofocus
      ></textarea>
      <div class="error-msg" id="descError">설명을 입력해 주세요.</div>
    </div>

    <!-- 그룹 -->
    <div class="field">
      <label>
        그룹
        <span class="hint">관련 변수끼리 묶어주는 카테고리</span>
      </label>
      <select id="group">
        ${groupOptions}
      </select>
    </div>

    <!-- 기본값 -->
    <div class="field">
      <label>
        기본값(플레이스홀더)
        <span class="hint">자동완성 시 삽입되는 예시 값</span>
      </label>
      <input
        type="text"
        id="defaultValue"
        placeholder="예: your_value_here"
        value="your_value_here"
      />
    </div>

    <div class="actions">
      <button type="button" class="btn-secondary" id="cancelBtn">취소</button>
      <button type="submit" class="btn-primary">사전에 추가 ✓</button>
    </div>
  </form>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('cancelBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'cancel' });
    });

    document.getElementById('form').addEventListener('submit', (e) => {
      e.preventDefault();

      const description = document.getElementById('description').value.trim();
      const descError   = document.getElementById('descError');

      // 유효성 검사
      if (!description) {
        document.getElementById('description').classList.add('error');
        descError.classList.add('visible');
        document.getElementById('description').focus();
        return;
      }

      document.getElementById('description').classList.remove('error');
      descError.classList.remove('visible');

      vscode.postMessage({
        command:      'submit',
        key:          '${key}',
        description,
        group:        document.getElementById('group').value,
        defaultValue: document.getElementById('defaultValue').value.trim(),
      });
    });

    // 입력 시 에러 상태 초기화
    document.getElementById('description').addEventListener('input', () => {
      document.getElementById('description').classList.remove('error');
      document.getElementById('descError').classList.remove('visible');
    });
  </script>
</body>
</html>`;
}
