const fs = require('fs');
const path = require('path');

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const CONTAINER_SERVICE_URL_KEYS = ['DATABASE_URL', 'REDIS_URL'];

function stripWrappingQuotes(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ')
      ? line.slice('export '.length).trim()
      : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(normalized.slice(separatorIndex + 1).trim());
    if (!key) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

function loadEnvFiles(appDir, env = process.env, envName = 'production') {
  const lockedKeys = new Set(Object.keys(env));
  const candidates = [
    '.env',
    `.env.${envName}`,
    '.env.local',
    `.env.${envName}.local`,
  ];

  for (const name of candidates) {
    const filePath = path.join(appDir, name);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnvFile(fs.readFileSync(filePath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (lockedKeys.has(key)) {
        continue;
      }
      env[key] = value;
    }
  }

  return env;
}

function rewriteLocalhostServiceUrls(env = process.env, options = {}) {
  const inContainer = options.inContainer === true;
  const dockerHost = options.dockerHost || 'host.docker.internal';

  if (!inContainer) {
    return env;
  }

  for (const key of CONTAINER_SERVICE_URL_KEYS) {
    const value = env[key];
    if (typeof value !== 'string' || !value) {
      continue;
    }

    try {
      const parsed = new URL(value);
      if (!LOCALHOST_HOSTNAMES.has(parsed.hostname)) {
        continue;
      }
      parsed.hostname = dockerHost;
      env[key] = parsed.toString();
    } catch (_error) {
      continue;
    }
  }

  return env;
}

function copyTree(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  if (path.resolve(sourceDir) === path.resolve(targetDir)) {
    return;
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function syncRuntimeAssets(params) {
  const { appDir, appBundleDir } = params;

  copyTree(
    path.join(appDir, '.next', 'static'),
    path.join(appBundleDir, '.next', 'static')
  );
  copyTree(path.join(appDir, 'public'), path.join(appBundleDir, 'public'));
}

function resolveStandaloneServer(appDir) {
  const candidates = [
    path.join(appDir, 'server.js'),
    path.join(appDir, '.next', 'standalone', 'server.js'),
    path.join(appDir, '.next', 'standalone', 'apps', 'web', 'server.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('未找到 standalone server.js，请先运行 pnpm build');
}

module.exports = {
  loadEnvFiles,
  parseEnvFile,
  resolveStandaloneServer,
  rewriteLocalhostServiceUrls,
  syncRuntimeAssets,
};
