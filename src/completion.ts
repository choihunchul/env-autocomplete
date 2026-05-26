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

export function buildSnippetText(key: string, info: EnvKeyInfo): string {
  const commentLine = `# [${info.group}] ${info.description}`;
  const valueLine = `${key}=\${1:${info.value}}`;
  return `${commentLine}\n${valueLine}`;
}

