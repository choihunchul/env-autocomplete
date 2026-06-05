import { parseEnv, generateExampleFromEnv, generateEnvFromExample, stripValues } from '../src/sync';

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

describe('generateEnvFromExample', () => {
  it('should sync missing keys from example to env without overwriting existing env values', () => {
    const exampleContent = `# Database\nDB_PASSWORD=\nPORT=3000\nNEW_KEY=123`;
    const envContent = `# Database\nDB_PASSWORD=my_secret\n`;
    
    const result = generateEnvFromExample(exampleContent, envContent);
    
    // DB_PASSWORD는 덮어씌워지지 않고 기존 my_secret 유지, PORT와 NEW_KEY는 추가됨
    expect(result).toContain('DB_PASSWORD=my_secret');
    expect(result).toContain('PORT=3000');
    expect(result).toContain('NEW_KEY=123');
  });
});

describe('stripValues', () => {
  it('should strip values from env lines keeping keys and comments', () => {
    const content = `# Comment\nDB_HOST=localhost\nDB_PASS=1234\n\n# Group2\nPORT=3000`;
    const result = stripValues(content);
    expect(result).toBe(`# Comment\nDB_HOST=\nDB_PASS=\n\n# Group2\nPORT=\n`);
  });
});



