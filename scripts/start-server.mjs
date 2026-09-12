import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './sites-env.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

// Ensure memory stays within Render Free Tier limits (512MB RAM)
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('max-old-space-size')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-old-space-size=384`.trim();
}

// Ensure .wrangler/state directory exists for local D1 persistence
try {
  mkdirSync(path.join(projectRoot, '.wrangler', 'state'), { recursive: true });
} catch {}

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
const port = process.env.PORT || '10000';

console.log(`[start-server] Launching Wrangler from: ${wranglerBin}`);
console.log(`[start-server] Binding to ${host}:${port}`);
console.log(`[render] Ready: Listening on http://${host}:${port}`);

// Forward secrets and environment variables from container (Render / Fly.io secrets) to Wrangler/workerd
const varsToForward = {};
const allowedEnvKeys = [
  'GROQ_API_KEY', 'groq_api_key', 'GROQ_KEY',
  'GEMINI_API_KEY', 'gemini_api_key',
  'AI_PROVIDER', 'OPENAI_API_KEY', 'NODE_ENV'
];

for (const key of allowedEnvKeys) {
  if (process.env[key]) {
    varsToForward[key.toUpperCase()] = process.env[key];
  }
}

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

if (Object.keys(varsToForward).length > 0) {
  console.log(`[start-server] Forwarding secrets to Cloudflare Wrangler/workerd:`, Object.keys(varsToForward));

  // 1. Write .dev.vars in projectRoot and dist/server
  const devVarsContent = Object.entries(varsToForward)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join('\n') + '\n';

  try {
    writeFileSync(path.join(projectRoot, '.dev.vars'), devVarsContent);
    const distServerDir = path.join(projectRoot, 'dist', 'server');
    if (existsSync(distServerDir)) {
      writeFileSync(path.join(distServerDir, '.dev.vars'), devVarsContent);
    }
  } catch (err) {
    console.warn('[start-server] Notice writing .dev.vars:', err);
  }

  // 2. Inject into dist/server/wrangler.json
  try {
    const wranglerConfigPath = path.join(projectRoot, 'dist', 'server', 'wrangler.json');
    if (existsSync(wranglerConfigPath)) {
      const config = JSON.parse(readFileSync(wranglerConfigPath, 'utf8'));
      config.vars = { ...(config.vars || {}), ...varsToForward };
      writeFileSync(wranglerConfigPath, JSON.stringify(config, null, 2));
      console.log('[start-server] Injected secrets into dist/server/wrangler.json');
    }
  } catch (err) {
    console.warn('[start-server] Notice injecting wrangler.json:', err);
  }

  // 3. Append --var flags to rawArgs
  for (const [k, v] of Object.entries(varsToForward)) {
    rawArgs.push('--var', `${k}:${v}`);
  }
}

const args = isJs ? [wranglerBin, ...rawArgs] : rawArgs;

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
