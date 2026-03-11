const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadEnvFiles,
  parseEnvFile,
  resolveStandaloneServer,
  rewriteLocalhostServiceUrls,
  syncRuntimeAssets,
} = require('../standalone-runtime');

describe('standalone-runtime', () => {
  it('parses dotenv content with quotes and export prefix', () => {
    const parsed = parseEnvFile(`
      FOO=bar
      export BAR="quoted value"
      BAZ='single quoted'
      # comment
      EMPTY=
    `);

    expect(parsed).toEqual({
      FOO: 'bar',
      BAR: 'quoted value',
      BAZ: 'single quoted',
      EMPTY: '',
    });
  });

  it('loads .env.local after .env without overriding existing env', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone-env-'));
    fs.writeFileSync(path.join(tempDir, '.env'), 'DATABASE_URL=postgres://env\nPORT=3000\n');
    fs.writeFileSync(path.join(tempDir, '.env.local'), 'PORT=3001\nREDIS_URL=redis://local\n');

    const env = { PORT: '9999' };
    loadEnvFiles(tempDir, env);

    expect(env).toMatchObject({
      DATABASE_URL: 'postgres://env',
      PORT: '9999',
      REDIS_URL: 'redis://local',
    });
  });



  it('resolves direct server.js from extracted standalone bundle', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone-server-'));
    fs.writeFileSync(path.join(tempDir, 'server.js'), 'console.log(1)');

    expect(resolveStandaloneServer(tempDir)).toBe(path.join(tempDir, 'server.js'));
  });

  it('keeps runtime assets when source and target are the same path', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone-same-'));
    const staticDir = path.join(tempDir, '.next', 'static', 'chunks');
    const publicDir = path.join(tempDir, 'public');

    fs.mkdirSync(staticDir, { recursive: true });
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(staticDir, 'main.js'), 'console.log("same")');
    fs.writeFileSync(path.join(publicDir, 'favicon.svg'), '<svg>same</svg>');

    syncRuntimeAssets({
      appDir: tempDir,
      appBundleDir: tempDir,
    });

    expect(
      fs.readFileSync(path.join(staticDir, 'main.js'), 'utf8')
    ).toBe('console.log("same")');
    expect(
      fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8')
    ).toBe('<svg>same</svg>');
  });

  it('rewrites localhost service urls for docker runtime', () => {
    const env = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      REDIS_URL: 'redis://127.0.0.1:6379',
      API_BASE_URL: 'http://localhost:3000',
    };

    rewriteLocalhostServiceUrls(env, {
      inContainer: true,
      dockerHost: 'host.docker.internal',
    });

    expect(env).toMatchObject({
      DATABASE_URL: 'postgresql://user:pass@host.docker.internal:5432/app',
      REDIS_URL: 'redis://host.docker.internal:6379',
      API_BASE_URL: 'http://localhost:3000',
    });
  });

  it('copies static and public assets into standalone runtime tree', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'standalone-assets-'));
    const staticSrc = path.join(tempDir, '.next', 'static', 'chunks');
    const publicSrc = path.join(tempDir, 'public');
    const standaloneDir = path.join(tempDir, '.next', 'standalone');

    fs.mkdirSync(staticSrc, { recursive: true });
    fs.mkdirSync(publicSrc, { recursive: true });
    fs.mkdirSync(path.join(standaloneDir, 'apps', 'web'), { recursive: true });
    fs.writeFileSync(path.join(staticSrc, 'main.js'), 'console.log("ok")');
    fs.writeFileSync(path.join(publicSrc, 'favicon.svg'), '<svg></svg>');

    syncRuntimeAssets({
      appDir: tempDir,
      standaloneDir,
      appBundleDir: path.join(standaloneDir, 'apps', 'web'),
    });

    expect(
      fs.readFileSync(
        path.join(standaloneDir, 'apps', 'web', '.next', 'static', 'chunks', 'main.js'),
        'utf8'
      )
    ).toBe('console.log("ok")');
    expect(
      fs.readFileSync(
        path.join(standaloneDir, 'apps', 'web', 'public', 'favicon.svg'),
        'utf8'
      )
    ).toBe('<svg></svg>');
  });
});
