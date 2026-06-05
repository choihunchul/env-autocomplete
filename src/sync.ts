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
