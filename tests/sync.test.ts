import { parseEnv } from '../src/sync';

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
