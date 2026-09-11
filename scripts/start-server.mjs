import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './sites-env.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function findWranglerBin() {
  const directPath = path.join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (existsSync(directPath)) return directPath;

  const binPath = path.join(projectRoot, 'node_modules', '.bin', 'wrangler');
  if (existsSync(binPath)) return binPath;

  const binJsPath = path.join(projectRoot, 'node_modules', '.bin', 'wrangler.js');
  if (existsSync(binJsPath)) return binJsPath;

  const pnpmDir = path.join(projectRoot, 'node_modules', '.pnpm');
  if (existsSync(pnpmDir)) {
    try {
      const entries = readdirSync(pnpmDir);
      for (const entry of entries) {
        if (entry.startsWith('wrangler@')) {
          const candidate = path.join(pnpmDir, entry, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
          if (existsSync(candidate)) return candidate;
        }
      }
    } catch {}
  }

  return 'wrangler';
}

const wranglerBin = findWranglerBin();
const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '3000';

console.log(`[start-server] Launching Wrangler from: ${wranglerBin}`);
console.log(`[start-server] Binding to ${host}:${port}`);

const isJs = wranglerBin.endsWith('.js');
const command = isJs ? process.execPath : wranglerBin;
const rawArgs = [
  'dev',
  '--config', 'dist/server/wrangler.json',
  '--local',
  '--persist-to', '.wrangler/state',
  '--ip', host,
  '--port', port,
  '--inspector-port', '0'
];
const args = isJs ? [wranglerBin, ...rawArgs] : rawArgs;

const child = spawn(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    HOST: host,
    PORT: port
  }
});

child.on('error', (err) => {
  console.error('[start-server] Failed to start Wrangler:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) {
      child.kill(sig);
    }
  });
}
