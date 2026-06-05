import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { mergeDictionaries, EnvKeyInfo } from './completion';
import { scanContentForEnvKeys } from './scanner';
import { openAddKeyPanel } from './addKeyPanel';
import { formatEnvDocument } from './formatter';
import { generateExampleFromEnv, generateEnvFromExample, stripValues } from './sync';

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const UNKNOWN_KEY_DIAGNOSTIC_CODE = 'unknown-env-key';
const UNKNOWN_KEY_DIAGNOSTIC_SOURCE = 'Env Autocomplete';
const EMPTY_VALUE_DIAGNOSTIC_CODE = 'empty-env-value';

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
        vscode.l10n.t('🔒 **Value is masked.**\n\nClick the line to edit.\n\n`envAutocomplete.maskValues: false` to disable.')
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
    contentText: ` ⚠ ${vscode.l10n.t('Unregistered key')}`,
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

    const key   = match[1];
    const value = match[2].trim();

    // ── 빈 값 경고 (.env.example는 제외) ─────────────────────────────
    const isExample = path.basename(editor.document.uri.fsPath).endsWith('.example');
    if (!isExample && value === '') {
      const eqPos   = key.length;                              // '=' 위치
      const eqRange = new vscode.Range(i, eqPos, i, eqPos + 1);
      const diag = new vscode.Diagnostic(
        eqRange,
        vscode.l10n.t("'{0}' has no value set.", key),
        vscode.DiagnosticSeverity.Warning
      );
      diag.code   = EMPTY_VALUE_DIAGNOSTIC_CODE;
      diag.source = UNKNOWN_KEY_DIAGNOSTIC_SOURCE;
      diagnostics.push(diag);
    }

    // ── 미등록 키 경고 ───────────────────────────────────────────
    if (knownKeys.has(key)) { continue; }

    const keyRange = new vscode.Range(i, 0, i, key.length);

    decorations.push({
      range: keyRange,
      hoverMessage: new vscode.MarkdownString(
        vscode.l10n.t('⚠ **`{0}`** is not registered in the dictionary.\n\n💡 Click the lightbulb (or `Ctrl+.`) to add it.', key)
      ),
    });

    const diagnostic = new vscode.Diagnostic(
      keyRange,
      vscode.l10n.t("'{0}' is not registered in the ENV Autocomplete dictionary.", key),
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
// 4-b. .env ↔ .env.example 키 동기화 경고 Diagnostic
// ═════════════════════════════════════════════════════════════════════════════
const ENV_SYNC_SOURCE = 'ENV Sync';

function checkEnvExampleSync(
  document: vscode.TextDocument,
  syncDiagnostics: vscode.DiagnosticCollection
): void {
  const filePath = document.uri.fsPath;
  const basename = path.basename(filePath);

  if (!basename.match(/^\.env/)) {
    syncDiagnostics.set(document.uri, []);
    return;
  }

  const isExample = basename.endsWith('.example');
  const diagnostics: vscode.Diagnostic[] = [];

  if (isExample) {
    // ── .env.example 열림: 반대편 .env 확인 ──────────────────────────
    const envPath = filePath.replace(/\.example$/, '');

    if (!fs.existsSync(envPath)) {
      const diag = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        vscode.l10n.t('.env file is missing. Right-click → "ENV: Create/Sync .env" to create it.'),
        vscode.DiagnosticSeverity.Warning
      );
      diag.source = ENV_SYNC_SOURCE;
      diagnostics.push(diag);
      syncDiagnostics.set(document.uri, diagnostics);
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const envKeys = new Set(
      envContent
        .split(/\r?\n/)
        .map(l => LINE_REGEX.exec(l.trim()))
        .filter((m): m is RegExpExecArray => m !== null)
        .map(m => m[1])
    );

    for (let i = 0; i < document.lineCount; i++) {
      const match = LINE_REGEX.exec(document.lineAt(i).text.trim());
      if (!match) { continue; }
      const key = match[1];
      if (!envKeys.has(key)) {
        const diag = new vscode.Diagnostic(
          new vscode.Range(i, 0, i, key.length),
          vscode.l10n.t("'{0}' key is missing from .env. Sync is needed.", key),
          vscode.DiagnosticSeverity.Warning
        );
        diag.source = ENV_SYNC_SOURCE;
        diagnostics.push(diag);
      }
    }

  } else {
    // ── .env 열림: 반대편 .env.example 확인 ────────────────────────
    const examplePath = filePath + '.example';

    if (!fs.existsSync(examplePath)) {
      const diag = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        vscode.l10n.t('.env.example file is missing. Right-click → "ENV: Create/Sync .env.example" to create it.'),
        vscode.DiagnosticSeverity.Warning
      );
      diag.source = ENV_SYNC_SOURCE;
      diagnostics.push(diag);
      syncDiagnostics.set(document.uri, diagnostics);
      return;
    }

    const exampleContent = fs.readFileSync(examplePath, 'utf8');
    const exampleKeys = new Set(
      exampleContent
        .split(/\r?\n/)
        .map(l => LINE_REGEX.exec(l.trim()))
        .filter((m): m is RegExpExecArray => m !== null)
        .map(m => m[1])
    );

    for (let i = 0; i < document.lineCount; i++) {
      const match = LINE_REGEX.exec(document.lineAt(i).text.trim());
      if (!match) { continue; }
      const key = match[1];
      if (!exampleKeys.has(key)) {
        const diag = new vscode.Diagnostic(
          new vscode.Range(i, 0, i, key.length),
          vscode.l10n.t("'{0}' key is missing from .env.example. Sync is needed.", key),
          vscode.DiagnosticSeverity.Warning
        );
        diag.source = ENV_SYNC_SOURCE;
        diagnostics.push(diag);
      }
    }
  }

  syncDiagnostics.set(document.uri, diagnostics);
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. 익스텐션 진입점
// ═════════════════════════════════════════════════════════════════════════════
export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection('envAutocomplete');
  const syncDiagnosticCollection =
    vscode.languages.createDiagnosticCollection('env-sync');

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
                    description: vscode.l10n.t('Detected by scanning project source code.'),
                    group: vscode.l10n.t('Scanned From Source'),
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
            vscode.l10n.t('**Description:** {0}\n\n**Default:** `{1}`', info.description, info.value)
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
              vscode.l10n.t("🔖 Add '{0}' to ENV dictionary", key),
              vscode.CodeActionKind.QuickFix
            );
            action.command = {
              command: 'envAutocomplete.addKeyToDictionary',
              title: vscode.l10n.t('Add to dictionary'),
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
    checkEnvExampleSync(vscode.window.activeTextEditor.document, syncDiagnosticCollection);
  }

  const onEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && isEnvFile(editor.document)) {
      refreshDecorations(editor, diagnosticCollection);
      checkEnvExampleSync(editor.document, syncDiagnosticCollection);
    }
  });

  const onDocChange = vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (editor &&
        editor.document === event.document &&
        isEnvFile(editor.document)) {
      refreshDecorations(editor, diagnosticCollection);
      checkEnvExampleSync(editor.document, syncDiagnosticCollection);
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
    syncDiagnosticCollection.delete(document.uri);
  });

  // ── 5-5. 가상 문서 프로바이더: 값 제거 Diff용 ─────────────────────────────
  const envKeyDiffScheme = 'env-key-diff';
  const envKeyDiffProvider = vscode.workspace.registerTextDocumentContentProvider(
    envKeyDiffScheme,
    {
      async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const targetUri = vscode.Uri.parse(uri.query);
        try {
          const doc = await vscode.workspace.openTextDocument(targetUri);
          return stripValues(doc.getText());
        } catch {
          return '';
        }
      }
    }
  );

  // ── 5-6. 커맨드: .env.example 작성/동기화 ────────────────────────────────
  const createOrSyncExampleCommand = vscode.commands.registerCommand(
    'envAutocomplete.createOrSyncExample',
    async (contextUri?: vscode.Uri) => {
      // 탐색기 우클릭 시 contextUri로 전달되고, 타이틀 바 클릭 시엔 activeTextEditor 사용
      const fileUri = contextUri ?? vscode.window.activeTextEditor?.document.uri;
      if (!fileUri) {
        vscode.window.showErrorMessage(vscode.l10n.t('ENV: Open or select a .env file.'));
        return;
      }

      const envFilePath = fileUri.fsPath;
      if (!envFilePath.endsWith('.env') && !path.basename(envFilePath).match(/^\.env$/)) {
        vscode.window.showErrorMessage(vscode.l10n.t('ENV: Only available for .env files.'));
        return;
      }

      const exampleFilePath = envFilePath + '.example';
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      const exampleContent = fs.existsSync(exampleFilePath)
        ? fs.readFileSync(exampleFilePath, 'utf8')
        : '';

      const config = vscode.workspace.getConfiguration('envAutocomplete');
      const enableBuiltIn = config.get<boolean>('enableBuiltInKeys', true);
      const customKeys = config.get<Record<string, EnvKeyInfo>>('customKeys', {});
      const dictionary = mergeDictionaries(enableBuiltIn, customKeys);

      const newContent = generateExampleFromEnv(envContent, exampleContent, dictionary);

      if (newContent === exampleContent) {
        vscode.window.showInformationMessage(vscode.l10n.t('ENV: .env.example is already up to date.'));
        return;
      }

      fs.writeFileSync(exampleFilePath, newContent, 'utf8');
      const doc = await vscode.workspace.openTextDocument(exampleFilePath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(vscode.l10n.t('ENV: .env.example created/synced!'));
    }
  );

  // ── 5-7. 커맨드: .env 작성/동기화 ───────────────────────────────────────
  const createOrSyncEnvCommand = vscode.commands.registerCommand(
    'envAutocomplete.createOrSyncEnv',
    async (contextUri?: vscode.Uri) => {
      const fileUri = contextUri ?? vscode.window.activeTextEditor?.document.uri;
      if (!fileUri) {
        vscode.window.showErrorMessage(vscode.l10n.t('ENV: Open or select a .env.example file.'));
        return;
      }

      const exampleFilePath = fileUri.fsPath;
      if (!path.basename(exampleFilePath).match(/^\.env\.example$/)) {
        vscode.window.showErrorMessage(vscode.l10n.t('ENV: Only available for .env.example files.'));
        return;
      }

      const envFilePath = exampleFilePath.replace(/\.example$/, '');
      const exampleContent = fs.readFileSync(exampleFilePath, 'utf8');
      const envContent = fs.existsSync(envFilePath)
        ? fs.readFileSync(envFilePath, 'utf8')
        : '';

      const newContent = generateEnvFromExample(exampleContent, envContent);

      if (newContent === envContent) {
        vscode.window.showInformationMessage(vscode.l10n.t('ENV: .env is already up to date.'));
        return;
      }

      fs.writeFileSync(envFilePath, newContent, 'utf8');
      const doc = await vscode.workspace.openTextDocument(envFilePath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(vscode.l10n.t('ENV: .env created/synced!'));
    }
  );

  // ── 5-8. 커맨드: 키 비교 (Compare Keys) ─────────────────────────────────
  const compareKeysCommand = vscode.commands.registerCommand(
    'envAutocomplete.compareKeys',
    async (contextUri?: vscode.Uri) => {
      const fileUri = contextUri ?? vscode.window.activeTextEditor?.document.uri;
      if (!fileUri) {
        vscode.window.showErrorMessage(vscode.l10n.t('ENV: Open or select a .env or .env.example file.'));
        return;
      }

      const filePath = fileUri.fsPath;
      const basename = path.basename(filePath);

      let envFilePath: string;
      let exampleFilePath: string;

      if (basename === '.env.example') {
        exampleFilePath = filePath;
        envFilePath = filePath.replace(/\.example$/, '');
      } else if (basename.match(/^\.env/)) {
        envFilePath = filePath;
        exampleFilePath = filePath.endsWith('.example') ? filePath : filePath + '.example';
      } else {
        vscode.window.showErrorMessage(vscode.l10n.t('ENV: Only available for .env or .env.example files.'));
        return;
      }

      if (!fs.existsSync(envFilePath)) {
        vscode.window.showErrorMessage(vscode.l10n.t('ENV: {0} does not exist.', path.basename(envFilePath)));
        return;
      }
      if (!fs.existsSync(exampleFilePath)) {
        vscode.window.showErrorMessage(vscode.l10n.t('ENV: {0} does not exist.', path.basename(exampleFilePath)));
        return;
      }

      // 값을 제거한 가상 URI 생성 (env-key-diff://authority/filename?realUri)
      const envVirtualUri = vscode.Uri.parse(
        `${envKeyDiffScheme}://authority/${path.basename(envFilePath)}?${vscode.Uri.file(envFilePath).toString()}`
      );
      const exampleVirtualUri = vscode.Uri.parse(
        `${envKeyDiffScheme}://authority/${path.basename(exampleFilePath)}?${vscode.Uri.file(exampleFilePath).toString()}`
      );

      await vscode.commands.executeCommand(
        'vscode.diff',
        envVirtualUri,
        exampleVirtualUri,
        vscode.l10n.t('.env ↔ .env.example (Key Comparison)')
      );
    }
  );

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
    syncDiagnosticCollection,
    envKeyDiffProvider,
    createOrSyncExampleCommand,
    createOrSyncEnvCommand,
    compareKeysCommand,
  );
}

export function deactivate() {}
