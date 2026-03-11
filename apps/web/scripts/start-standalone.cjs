const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const {
  loadEnvFiles,
  resolveStandaloneServer,
  rewriteLocalhostServiceUrls,
  syncRuntimeAssets,
} = require('../src/lib/standalone-runtime');

const appDir = path.resolve(__dirname, '..');

function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  loadEnvFiles(appDir, process.env, process.env.NODE_ENV);
  rewriteLocalhostServiceUrls(process.env, {
    inContainer: fs.existsSync('/.dockerenv'),
  });

  const serverFile = resolveStandaloneServer(appDir);
  const appBundleDir = path.dirname(serverFile);
  syncRuntimeAssets({
    appDir,
    appBundleDir,
  });

  const child = spawn(process.execPath, [serverFile], {
    cwd: appBundleDir,
    env: process.env,
    stdio: 'inherit',
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code, signal) => {
    process.removeListener('SIGINT', forwardSignal);
    process.removeListener('SIGTERM', forwardSignal);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code || 0);
  });
}

main();
