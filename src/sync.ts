export interface EnvEntry {
  key: string;
  value: string;
  commentBefore: string;
  rawLine: string;
}

export function parseEnv(content: string): EnvEntry[] {
  const lines = content.split(/\r?\n/);
  const result: EnvEntry[] = [];
  let currentComments: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) {
      currentComments.push(lines[i]); // 원본 라인을 보존하기 위해 trim하지 않은 원본을 씁니다.
      continue;
    }
    if (line === '') {
      currentComments = [];
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) {
      result.push({
        key: match[1],
        value: match[2],
        commentBefore: currentComments.join('\n'),
        rawLine: lines[i]
      });
      currentComments = [];
    } else {
      currentComments = [];
    }
  }
  return result;
}

export function generateExampleFromEnv(
  envContent: string,
  exampleContent: string,
  dictionary: Record<string, any>
): string {
  const envEntries = parseEnv(envContent);
  const exampleEntries = parseEnv(exampleContent);
  const exampleKeys = new Set(exampleEntries.map(e => e.key));

  let updatedContent = exampleContent.trim();
  if (updatedContent.length > 0 && !updatedContent.endsWith('\n')) {
    updatedContent += '\n';
  }

  let appended = false;
  for (const entry of envEntries) {
    if (!exampleKeys.has(entry.key)) {
      if (!appended && updatedContent.length > 0) {
        updatedContent += '\n';
        appended = true;
      }
      if (entry.commentBefore) {
        updatedContent += `${entry.commentBefore}\n`;
      }
      const defaultValue = dictionary[entry.key]?.value ?? '';
      updatedContent += `${entry.key}=${defaultValue}\n`;
    }
  }
  return updatedContent;
}

export function generateEnvFromExample(
  exampleContent: string,
  envContent: string
): string {
  const exampleEntries = parseEnv(exampleContent);
  const envEntries = parseEnv(envContent);
  const envKeys = new Set(envEntries.map(e => e.key));

  let updatedContent = envContent.trim();
  if (updatedContent.length > 0 && !updatedContent.endsWith('\n')) {
    updatedContent += '\n';
  }

  let appended = false;
  for (const entry of exampleEntries) {
    if (!envKeys.has(entry.key)) {
      if (!appended && updatedContent.length > 0) {
        updatedContent += '\n';
        appended = true;
      }
      if (entry.commentBefore) {
        updatedContent += `${entry.commentBefore}\n`;
      }
      updatedContent += `${entry.key}=${entry.value}\n`;
    }
  }
  return updatedContent;
}

export function stripValues(content: string): string {
  const lines = content.split(/\r?\n/);
  const strippedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') {
      return line;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (match) {
      return `${match[1]}=`;
    }
    return line;
  });
  const result = strippedLines.join('\n');
  return result.endsWith('\n') ? result : result + '\n';
}
