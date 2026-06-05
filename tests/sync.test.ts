import { parseEnv, generateExampleFromEnv } from '../src/sync';

describe('parseEnv', () => {
  it('should parse env lines with comments correctly', () => {
    const content = `# This is database group\nDB_HOST=localhost\n\n# JWT secret key\nJWT_SECRET=supersecret`;
    const result = parseEnv(content);
    expect(result).toEqual([
      { key: 'DB_HOST', value: 'localhost', commentBefore: '# This is database group', rawLine: 'DB_HOST=localhost' },
      { key: 'JWT_SECRET', value: 'supersecret', commentBefore: '# JWT secret key', rawLine: 'JWT_SECRET=supersecret' }
    ]);
  });
});

describe('generateExampleFromEnv', () => {
  it('should generate .env.example preserving comments and masking values', () => {
    const envContent = `# Database\nDB_PASSWORD=secret123\nPORT=8000`;
    const exampleContent = `# Database\nDB_PASSWORD=\n`;
    const dictionary = { PORT: { value: '3000', description: 'Port', group: 'App' } };
    
    const result = generateExampleFromEnv(envContent, exampleContent, dictionary);
    
    // DB_PASSWORD는 기존에 있으므로 보존, PORT는 새로 추가되면서 기본값인 3000 사용
    expect(result).toContain('DB_PASSWORD=');
    expect(result).toContain('# Database');
    expect(result).toContain('PORT=3000');
  });
});

