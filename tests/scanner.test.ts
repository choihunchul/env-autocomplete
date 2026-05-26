import { scanContentForEnvKeys } from '../src/scanner';

describe('Smart Project Scanner', () => {
  test('should detect basic process.env.KEY references in standard code declarations', () => {
    const content = `
      const apiKey = process.env.OPENAI_API_KEY;
      const port = process.env.PORT || 3000;
      console.log(process.env.DB_CONNECTION_STRING);
    `;

    const keys = scanContentForEnvKeys(content);
    expect(keys).toContain('OPENAI_API_KEY');
    expect(keys).toContain('PORT');
    expect(keys).toContain('DB_CONNECTION_STRING');
    expect(keys.size).toBe(3);
  });

  test('should strip single-line comments and not extract keys inside them', () => {
    const content = `
      const apiKey = process.env.OPENAI_API_KEY;
      // const port = process.env.PORT || 3000;
      //process.env.COMMENTED_OUT_KEY
    `;

    const keys = scanContentForEnvKeys(content);
    expect(keys).toContain('OPENAI_API_KEY');
    expect(keys).not.toContain('PORT');
    expect(keys).not.toContain('COMMENTED_OUT_KEY');
    expect(keys.size).toBe(1);
  });

  test('should strip block comments and multi-line comments correctly', () => {
    const content = `
      const activeKey = process.env.ACTIVE_KEY;
      /*
        const blockedKey1 = process.env.BLOCKED_IN_BLOCK_COMMENT;
      */
      /* const blockedKey2 = process.env.BLOCKED_INLINE_BLOCK_COMMENT; */
    `;

    const keys = scanContentForEnvKeys(content);
    expect(keys).toContain('ACTIVE_KEY');
    expect(keys).not.toContain('BLOCKED_IN_BLOCK_COMMENT');
    expect(keys).not.toContain('BLOCKED_INLINE_BLOCK_COMMENT');
    expect(keys.size).toBe(1);
  });

  test('should preserve string literals containing comment delimiters (like URLs) and scan subsequent keys', () => {
    const content = `
      const url = "https://example.com/api"; const key1 = process.env.VALID_KEY_ON_SAME_LINE;
      const path = 'some/path/with//two/slashes'; const key2 = process.env.ANOTHER_VALID_KEY;
      const template = \`http://localhost/\${process.env.PORT_FROM_TEMPLATE}\`;
    `;

    const keys = scanContentForEnvKeys(content);
    expect(keys).toContain('VALID_KEY_ON_SAME_LINE');
    expect(keys).toContain('ANOTHER_VALID_KEY');
    expect(keys).toContain('PORT_FROM_TEMPLATE');
    expect(keys.size).toBe(3);
  });

  test('should not extract keys that do not match the environment variable naming convention', () => {
    const content = `
      const invalid1 = process.env.lowercase_key;
      const invalid2 = process.env.123_STARTING_WITH_NUMBER;
      const valid = process.env.VALID_UPPERCASE_KEY;
    `;

    const keys = scanContentForEnvKeys(content);
    expect(keys).toContain('VALID_UPPERCASE_KEY');
    expect(keys).not.toContain('lowercase_key');
    expect(keys).not.toContain('123_STARTING_WITH_NUMBER');
    expect(keys.size).toBe(1);
  });

  test('should handle empty or unrelated code content gracefully', () => {
    const content = `
      function main() {
        console.log("No env keys here");
      }
    `;

    const keys = scanContentForEnvKeys(content);
    expect(keys.size).toBe(0);
  });
});

