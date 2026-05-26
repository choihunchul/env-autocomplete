import * as vscode from 'vscode';
import { mergeDictionaries, EnvKeyInfo } from './completion';
import { scanContentForEnvKeys } from './scanner';
import { openAddKeyPanel } from './addKeyPanel';
import { formatEnvDocument } from './formatter';

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const UNKNOWN_KEY_DIAGNOSTIC_CODE = 'unknown-env-key';
const UNKNOWN_KEY_DIAGNOSTIC_SOURCE = 'Env Autocomplete';

/** KEY=VALUE 한 줄 파싱 (주석·빈줄 제외) */
const LINE_REGEX = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

// ─── .env 파일 판별 ───────────────────────────────────────────────────────────
function isEnvFile(document: vscode.TextDocument): boolean {
  const filename = document.fileName.split('/').pop() ?? '';
  return /^\.env(\.|$)/.test(filename);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. 마스킹 데코레이션
// ═════════════════════════════════════════════════════════════════════════════
const maskDecoration = vscode.window.createTextEditorDecorationType({
  textDecoration: 'none; display: none;',
  before: {
    contentText: '•••••',
    color: new vscode.ThemeColor('editorInfo.foreground'),
    fontStyle: 'italic',
  },
});

function applyMaskDecorations(
  editor: vscode.TextEditor,
  activeLine: number
): void {
  const config = vscode.workspace.getConfiguration('envAutocomplete');
  if (!config.get<boolean>('maskValues', true)) {
    editor.setDecorations(maskDecoration, []);
    return;
  }

  const ranges: vscode.DecorationOptions[] = [];
  for (let i = 0; i < editor.document.lineCount; i++) {
    if (i === activeLine) { continue; }
    const line = editor.document.lineAt(i);
    const match = LINE_REGEX.exec(line.text);
    if (!match || !match[2]) { continue; }

    const valueStart = match[1].length + 1; // '=' 다음
    const valueEnd   = line.text.length;
    if (valueStart >= valueEnd) { continue; }

    ranges.push({
      range: new vscode.Range(i, valueStart, i, valueEnd),
      hoverMessage: new vscode.MarkdownString(
        '🔒 **값이 마스킹되었습니다.**\n\n해당 줄을 클릭하면 편집할 수 있습니다.\n\n`envAutocomplete.maskValues: false` 로 비활성화할 수 있습니다.'
      ),
    });
  }
  editor.setDecorations(maskDecoration, ranges);
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. 미등록 키 하이라이트 + Diagnostic
// ═════════════════════════════════════════════════════════════════════════════
const unknownKeyDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
  border: '1px solid',
  borderColor: new vscode.ThemeColor('editorWarning.foreground'),
  borderRadius: '3px',
  overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'),
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: ' ⚠ 미등록 키',
    color: new vscode.ThemeColor('editorWarning.foreground'),
    fontStyle: 'italic',
    margin: '0 0 0 6px',
  },
});

/**
 * 미등록 키를 하이라이트하고 Diagnostic을 등록한다.
 * Diagnostic이 있어야 💡 Quick Fix 전구가 표시된다.
 */
async function applyUnknownKeyHighlights(
  editor: vscode.TextEditor,
  diagnosticCollection: vscode.DiagnosticCollection,
  knownKeys: Set<string>
): Promise<void> {
  const config = vscode.workspace.getConfiguration('envAutocomplete');
  if (!config.get<boolean>('highlightUnknownKeys', true)) {
    editor.setDecorations(unknownKeyDecoration, []);
    diagnosticCollection.set(editor.document.uri, []);
    return;
  }

  const decorations: vscode.DecorationOptions[] = [];
  const diagnostics: vscode.Diagnostic[] = [];

  for (let i = 0; i < editor.document.lineCount; i++) {
    const line = editor.document.lineAt(i);
    const match = LINE_REGEX.exec(line.text);
    if (!match) { continue; }

    const key = match[1];
    if (knownKeys.has(key)) { continue; }

    const keyRange = new vscode.Range(i, 0, i, key.length);

    decorations.push({
      range: keyRange,
      hoverMessage: new vscode.MarkdownString(
        `⚠ **\`${key}\`** 는 사전에 등록되지 않은 키입니다.\n\n` +
        `💡 전구 아이콘(또는 \`Ctrl+.\`)을 눌러 사전에 추가할 수 있습니다.`
      ),
    });

    const diagnostic = new vscode.Diagnostic(
      keyRange,
      `'${key}' 는 ENV Autocomplete 사전에 등록되지 않은 키입니다.`,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.code   = UNKNOWN_KEY_DIAGNOSTIC_CODE;
    diagnostic.source = UNKNOWN_KEY_DIAGNOSTIC_SOURCE;
    diagnostics.push(diagnostic);
  }

  editor.setDecorations(unknownKeyDecoration, decorations);
  diagnosticCollection.set(editor.document.uri, diagnostics);
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. 현재 사전(내장 + 커스텀) 키 집합 빌드
// ═════════════════════════════════════════════════════════════════════════════
function buildKnownKeySet(): Set<string> {
  const config      = vscode.workspace.getConfiguration('envAutocomplete');
  const enableBuiltIn = config.get<boolean>('enableBuiltInKeys', true);
  const customKeys    = config.get<Record<string, EnvKeyInfo>>('customKeys', {});
  const merged = mergeDictionaries(enableBuiltIn, customKeys);
  return new Set(Object.keys(merged));
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. 모든 데코레이션 일괄 갱신
// ═════════════════════════════════════════════════════════════════════════════
async function refreshDecorations(
  editor: vscode.TextEditor,
  diagnosticCollection: vscode.DiagnosticCollection
): Promise<void> {
  const activeLine = editor.selection.active.line;
  applyMaskDecorations(editor, activeLine);
  await applyUnknownKeyHighlights(editor, diagnosticCollection, buildKnownKeySet());
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. 익스텐션 진입점
// ═════════════════════════════════════════════════════════════════════════════
export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection('envAutocomplete');

  // ── 5-1. 자동 완성 프로바이더 ─────────────────────────────────────────────
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    { pattern: '**/.env*' },
    {
      async provideCompletionItems(document, position, _token, _ctx) {
        const config      = vscode.workspace.getConfiguration('envAutocomplete');
        const enableBuiltIn = config.get<boolean>('enableBuiltInKeys', true);
        const customKeys    = config.get<Record<string, EnvKeyInfo>>('customKeys', {});
        const scanProject   = config.get<boolean>('scanProjectForKeys', true);

        const merged = mergeDictionaries(enableBuiltIn, customKeys);

        if (scanProject) {
          const files = await vscode.workspace.findFiles(
            '**/*.{js,ts,jsx,tsx,py,go}', '**/node_modules/**'
          );
          for (const file of files) {
            try {
              const content     = (await vscode.workspace.openTextDocument(file)).getText();
              const scannedKeys = scanContentForEnvKeys(content);
              scannedKeys.forEach(key => {
                if (!merged[key]) {
                  merged[key] = {
                    value: 'your_value_here',
                    description: '프로젝트 소스 코드 스캔을 통해 감지된 환경 변수입니다.',
                    group: 'Scanned From Source',
                  };
                }
              });
            } catch { /* 파일 읽기 예외 무시 */ }
          }
        }

        return Object.entries(merged).map(([key, info]) => {
          const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
          item.detail = `[${info.group}]`;
          item.documentation = new vscode.MarkdownString(
            `**설명:** ${info.description}\n\n**기본값:** \`${info.value}\``
          );
          const snippet = new vscode.SnippetString();
          snippet.appendText(`# [${info.group}] ${info.description}\n`);
          snippet.appendText(`${key}=`);
          snippet.appendPlaceholder(info.value);
          item.insertText = snippet;
          return item;
        });
      },
    }
  );

  // ── 5-2. Quick Fix: 미등록 키 → 사전 추가 ────────────────────────────────
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    { pattern: '**/.env*' },
    {
      provideCodeActions(document, _range, context) {
        return context.diagnostics
          .filter(
            d =>
              d.code   === UNKNOWN_KEY_DIAGNOSTIC_CODE &&
              d.source === UNKNOWN_KEY_DIAGNOSTIC_SOURCE
          )
          .map(diagnostic => {
            const lineText = document.lineAt(diagnostic.range.start.line).text;
            const keyMatch = LINE_REGEX.exec(lineText);
            if (!keyMatch) { return undefined; }

            const key    = keyMatch[1];
            const action = new vscode.CodeAction(
              `🔖 '${key}' 를 ENV 사전에 추가`,
              vscode.CodeActionKind.QuickFix
            );
            action.command = {
              command: 'envAutocomplete.addKeyToDictionary',
              title: '사전에 추가',
              arguments: [key, document.uri],
            };
            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            return action;
          })
          .filter((a): a is vscode.CodeAction => a !== undefined);
      },
    },
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
  );

  // ── 5-3. 커맨드: 사전에 키 추가 ──────────────────────────────────────────
  const addKeyCommand = vscode.commands.registerCommand(
    'envAutocomplete.addKeyToDictionary',
    async (key: string) => {
      await openAddKeyPanel(context, key, () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && isEnvFile(editor.document)) {
          refreshDecorations(editor, diagnosticCollection);
        }
      });
    }
  );

  // ── 5-4. Format Document: 그룹별 정렬 + 섹션 주석 ───────────────────────
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
    { pattern: '**/.env*' },
    {
      provideDocumentFormattingEdits(document) {
        const config      = vscode.workspace.getConfiguration('envAutocomplete');
        const enableBuiltIn = config.get<boolean>('enableBuiltInKeys', true);
        const customKeys    = config.get<Record<string, EnvKeyInfo>>('customKeys', {});
        const dictionary    = mergeDictionaries(enableBuiltIn, customKeys);

        const formatted = formatEnvDocument(document.getText(), dictionary);

        // 변경이 없으면 빈 배열 반환 (불필요한 저장 방지)
        if (formatted === document.getText()) { return []; }

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        return [vscode.TextEdit.replace(fullRange, formatted)];
      },
    }
  );

  // ── 5-4. 이벤트 리스너 ───────────────────────────────────────────────────
  // 파일 최초 열기
  if (vscode.window.activeTextEditor &&
      isEnvFile(vscode.window.activeTextEditor.document)) {
    refreshDecorations(vscode.window.activeTextEditor, diagnosticCollection);
  }

  const onEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && isEnvFile(editor.document)) {
      refreshDecorations(editor, diagnosticCollection);
    }
  });

  const onDocChange = vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (editor &&
        editor.document === event.document &&
        isEnvFile(editor.document)) {
      refreshDecorations(editor, diagnosticCollection);
    }
  });

  const onSelectionChange = vscode.window.onDidChangeTextEditorSelection(event => {
    if (isEnvFile(event.textEditor.document)) {
      const activeLine = event.selections[0].active.line;
      applyMaskDecorations(event.textEditor, activeLine);
      // 선택 변경 시에는 마스킹만 빠르게 갱신 (highlight는 텍스트 변경 시에만)
    }
  });

  const onConfigChange = vscode.workspace.onDidChangeConfiguration(event => {
    const affected =
      event.affectsConfiguration('envAutocomplete.maskValues') ||
      event.affectsConfiguration('envAutocomplete.highlightUnknownKeys') ||
      event.affectsConfiguration('envAutocomplete.customKeys') ||
      event.affectsConfiguration('envAutocomplete.enableBuiltInKeys');

    if (affected) {
      const editor = vscode.window.activeTextEditor;
      if (editor && isEnvFile(editor.document)) {
        refreshDecorations(editor, diagnosticCollection);
      }
    }
  });

  // 파일 닫힐 때 Diagnostic 정리
  const onDocClose = vscode.workspace.onDidCloseTextDocument(document => {
    diagnosticCollection.delete(document.uri);
  });

  context.subscriptions.push(
    completionProvider,
    codeActionProvider,
    addKeyCommand,
    formattingProvider,
    diagnosticCollection,
    maskDecoration,
    unknownKeyDecoration,
    onEditorChange,
    onDocChange,
    onSelectionChange,
    onConfigChange,
    onDocClose,
  );
}

export function deactivate() {}
