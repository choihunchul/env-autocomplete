/**
 * Scans source code content to extract all referenced `process.env.KEY` names.
 *
 * Implements robust lexical comment stripping that avoids stripping valid
 * single-line or multi-line comment characters inside string literals (e.g. URLs).
 *
 * @param content The source code content to scan.
 * @returns A set of unique environment variable keys.
 */
export function scanContentForEnvKeys(content: string): Set<string> {
  // Regex that matches either:
  // - A double-quoted, single-quoted, or backtick template string literal (non-capturing)
  // - Or a multi-line block comment (/* ... */) or single-line comment (// ...) in Group 1
  const lexRegex = /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\/\*[\s\S]*?\*\/|\/\/.*$)/gm;

  // Replace comments with empty strings, leaving string literals intact
  const cleanContent = content.replace(lexRegex, (match, comment) => {
    // If the matched substring is a comment (captured in Group 1), replace it with an empty string.
    // Otherwise, it was a string literal; return it as-is to preserve URLs and string contents.
    return comment !== undefined ? '' : match;
  });

  const foundKeys = new Set<string>();
  const envRegex = /\bprocess\.env\.([A-Z_][A-Z0-9_]*)\b/g;

  for (const match of cleanContent.matchAll(envRegex)) {
    if (match[1]) {
      foundKeys.add(match[1]);
    }
  }

  return foundKeys;
}

