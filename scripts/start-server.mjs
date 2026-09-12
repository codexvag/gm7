import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

// Ensure memory stays within Render Free Tier limits (512MB RAM)
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('max-old-space-size')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-old-space-size=384`.trim();
}

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '10000';

console.log(`[start-server] Launching Node Native Server`);
console.log(`[start-server] Binding to ${host}:${port}`);

const command = process.execPath;
const args = [path.join(projectRoot, 'server.mjs')];

const child = spawn(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    HOST: host,
    PORT: port,
    NODE_OPTIONS: process.env.NODE_OPTIONS
  }
});

child.on('error', (err) => {
  console.error('[start-server] Failed to start server:', err);
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
